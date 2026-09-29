import * as XLSX from 'xlsx';
import { EXPENSE_CATEGORIES, ExpenseCategory } from '../expense/expense.model.js';
import { inferReceiptCategory } from './receipt.category.js';
import {
  buildReceiptWarnings,
  extractTotalFromOcrText,
  overallConfidence,
  parseMoney,
  parseReceiptDate,
  sanitizeLineItems,
} from './receipt.validation.js';
import { ExtractedField, ReceiptLineItem, ReceiptScanResult } from './receipt.types.js';
import { parseDateValue } from '../import/import.utils.js';

export type ReceiptFileKind = 'image' | 'pdf' | 'csv' | 'excel';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const EXTENSION_KIND: Record<string, ReceiptFileKind> = {
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.webp': 'image',
  '.pdf': 'pdf',
  '.csv': 'csv',
  '.xlsx': 'excel',
  '.xls': 'excel',
};

const MIME_KIND: Record<string, ReceiptFileKind> = {
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'application/pdf': 'pdf',
  'text/csv': 'csv',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
};

type ParsedRow = {
  amount: number;
  description: string;
  date: string | null;
  merchant: string | null;
  category: string | null;
  paymentMethod: string | null;
};

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function headerIndex(headers: string[], aliases: string[]) {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const index = normalized.indexOf(normalizeHeader(alias));
    if (index >= 0) return index;
  }
  return -1;
}

function matchCategory(value: string | null): ExpenseCategory {
  if (!value) return 'Other';
  const exact = EXPENSE_CATEGORIES.find((item) => item.toLowerCase() === value.toLowerCase());
  return exact || 'Other';
}

function rowsFromWorkbook(buffer: Buffer): unknown[][] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];
}

function rowsFromCsv(buffer: Buffer): unknown[][] {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const workbook = XLSX.read(text, { type: 'string' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];
}

function parseTabularRows(rows: unknown[][]): ParsedRow[] {
  if (rows.length === 0) return [];

  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) =>
      /amount|total|description|merchant|vendor|date|category|payment/i.test(String(cell ?? ''))
    )
  );

  const headerRow = headerRowIndex >= 0 ? rows[headerRowIndex] : rows[0];
  const headers = headerRow.map((cell) => String(cell ?? ''));

  const amountIdx = headerIndex(headers, ['total', 'totalamount', 'amount', 'price', 'cost', 'grandtotal']);
  const descriptionIdx = headerIndex(headers, ['description', 'desc', 'item', 'details', 'narration', 'memo']);
  const merchantIdx = headerIndex(headers, ['merchant', 'vendor', 'store', 'supplier', 'source', 'payee']);
  const dateIdx = headerIndex(headers, ['date', 'receiptdate', 'transactiondate', 'txndate']);
  const categoryIdx = headerIndex(headers, ['category', 'type']);
  const paymentIdx = headerIndex(headers, ['paymentmethod', 'payment', 'method']);

  const dataRows = headerRowIndex >= 0 ? rows.slice(headerRowIndex + 1) : rows.slice(1);
  const parsed: ParsedRow[] = [];

  for (const row of dataRows) {
    const cells = Array.isArray(row) ? row : [];
    const amountRaw =
      amountIdx >= 0 ? cells[amountIdx] : cells.find((cell) => parseMoney(cell) !== null && parseMoney(cell)! > 0);
    const amount = parseMoney(amountRaw);
    if (amount === null || amount <= 0) continue;

    const description =
      (descriptionIdx >= 0 ? String(cells[descriptionIdx] ?? '').trim() : '') ||
      (merchantIdx >= 0 ? String(cells[merchantIdx] ?? '').trim() : '') ||
      'Imported expense';

    parsed.push({
      amount,
      description,
      date: dateIdx >= 0 ? parseDateValue(cells[dateIdx]) : null,
      merchant: merchantIdx >= 0 ? String(cells[merchantIdx] ?? '').trim() || null : null,
      category: categoryIdx >= 0 ? String(cells[categoryIdx] ?? '').trim() || null : null,
      paymentMethod: paymentIdx >= 0 ? String(cells[paymentIdx] ?? '').trim() || null : null,
    });
  }

  return parsed;
}

function buildResultFromText(ocrText: string, source: ReceiptScanResult['extractionSource']): ReceiptScanResult {
  const labeled = extractTotalFromOcrText(ocrText);
  const totalAmount: ExtractedField<number> =
    labeled.value !== null
      ? { value: labeled.value, confidence: 0.78 }
      : { value: null, confidence: 0 };

  const lines = ocrText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const merchantName: ExtractedField<string> = {
    value: lines[0]?.slice(0, 120) || null,
    confidence: lines[0] ? 0.65 : 0,
  };

  const dateMatch = ocrText.match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/);
  const receiptDate = parseReceiptDate(dateMatch?.[1] || null);

  const categoryInference = inferReceiptCategory({
    merchant: merchantName.value,
    lineItems: [],
    ocrText,
    aiCategory: null,
  });

  const description: ExtractedField<string> = {
    value: merchantName.value ? `${merchantName.value} document` : 'Imported receipt document',
    confidence: 0.7,
  };

  const warnings = buildReceiptWarnings({
    merchantName,
    totalAmount,
    subtotal: { value: null, confidence: 0 },
    tax: { value: null, confidence: 0 },
    discount: { value: null, confidence: 0 },
    receiptDate,
    lineItems: [],
  });

  if (totalAmount.value === null) {
    warnings.push('Total amount was not detected in the document text. Please enter it manually.');
  }

  const confidence = overallConfidence([merchantName, totalAmount, receiptDate, { value: categoryInference.category, confidence: categoryInference.confidence }]);

  return {
    merchantName,
    totalAmount,
    currency: { value: /pkr|rs\.?/i.test(ocrText) ? 'PKR' : null, confidence: 0.6 },
    subtotal: { value: null, confidence: 0 },
    tax: { value: null, confidence: 0 },
    discount: { value: null, confidence: 0 },
    receiptDate,
    receiptTime: { value: null, confidence: 0 },
    category: { value: categoryInference.category, confidence: categoryInference.confidence },
    paymentMethod: { value: null, confidence: 0 },
    description,
    lineItems: [],
    confidence,
    warnings,
    reviewRequired: totalAmount.value === null || merchantName.value === null || warnings.length > 0,
    extractionSource: source,
    categoryReason: categoryInference.reason,
    debug: { ocrTextPreview: ocrText.slice(0, 500), totalLabelUsed: labeled.label, parsingNotes: [`Parsed from ${source}`] },
  };
}

function buildResultFromRows(rows: ParsedRow[], source: ReceiptScanResult['extractionSource']): ReceiptScanResult {
  if (rows.length === 0) {
    throw new Error('NO_ROWS');
  }

  const totalAmountValue = rows.reduce((sum, row) => sum + row.amount, 0);
  const primary = rows[0];
  const merchantName: ExtractedField<string> = {
    value: primary.merchant || primary.description || null,
    confidence: primary.merchant ? 0.9 : 0.75,
  };

  const description: ExtractedField<string> = {
    value:
      rows.length === 1
        ? primary.description
        : `${primary.description}${rows.length > 1 ? ` (+${rows.length - 1} more row${rows.length > 2 ? 's' : ''})` : ''}`,
    confidence: 0.85,
  };

  const receiptDate = parseReceiptDate(primary.date);
  const lineItems: ReceiptLineItem[] = rows.map((row) => ({
    name: row.description,
    quantity: null,
    unitPrice: null,
    totalPrice: row.amount,
  }));

  const categoryInference = inferReceiptCategory({
    merchant: merchantName.value,
    lineItems,
    ocrText: rows.map((row) => `${row.description} ${row.amount}`).join('\n'),
    aiCategory: primary.category,
  });

  const totalAmount: ExtractedField<number> = { value: totalAmountValue, confidence: 0.92 };
  const category: ExtractedField<ExpenseCategory> = {
    value: primary.category ? matchCategory(primary.category) : categoryInference.category,
    confidence: primary.category ? 0.9 : categoryInference.confidence,
  };

  const paymentMethod: ExtractedField<string> = {
    value: primary.paymentMethod,
    confidence: primary.paymentMethod ? 0.85 : 0,
  };

  const warnings = buildReceiptWarnings({
    merchantName,
    totalAmount,
    subtotal: { value: null, confidence: 0 },
    tax: { value: null, confidence: 0 },
    discount: { value: null, confidence: 0 },
    receiptDate,
    lineItems,
  });

  if (rows.length > 1) {
    warnings.push(`Imported ${rows.length} rows from the spreadsheet/CSV. Total amount is the sum of all rows.`);
  }

  const confidence = overallConfidence([merchantName, totalAmount, receiptDate, category, paymentMethod]);

  return {
    merchantName,
    totalAmount,
    currency: { value: 'PKR', confidence: 0.5 },
    subtotal: { value: null, confidence: 0 },
    tax: { value: null, confidence: 0 },
    discount: { value: null, confidence: 0 },
    receiptDate,
    receiptTime: { value: null, confidence: 0 },
    category,
    paymentMethod,
    description,
    lineItems: sanitizeLineItems(lineItems),
    confidence,
    warnings,
    reviewRequired: receiptDate.value === null || warnings.length > 0,
    extractionSource: source,
    categoryReason: categoryInference.reason,
    debug: { parsingNotes: [`Parsed ${rows.length} row(s) from ${source}`] },
  };
}

export function detectReceiptFileKind(mimeType?: string, fileName?: string): ReceiptFileKind | null {
  const mime = (mimeType || '').toLowerCase();
  if (mime && MIME_KIND[mime]) return MIME_KIND[mime];

  const lower = (fileName || '').toLowerCase();
  const ext = Object.keys(EXTENSION_KIND).find((key) => lower.endsWith(key));
  return ext ? EXTENSION_KIND[ext] : null;
}

export function isSupportedReceiptKind(kind: ReceiptFileKind | null): kind is ReceiptFileKind {
  return kind !== null;
}

export function validateReceiptFile(buffer: Buffer, mimeType?: string, fileName?: string) {
  if (!buffer || buffer.length === 0) {
    throw new Error('EMPTY');
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error('TOO_LARGE');
  }
  const kind = detectReceiptFileKind(mimeType, fileName);
  if (!kind) {
    throw new Error('UNSUPPORTED');
  }
  return kind;
}

export async function parseReceiptDocument(
  buffer: Buffer,
  kind: Exclude<ReceiptFileKind, 'image'>,
  fileName?: string
): Promise<ReceiptScanResult> {
  if (kind === 'csv' || kind === 'excel') {
    const rows = kind === 'csv' ? rowsFromCsv(buffer) : rowsFromWorkbook(buffer);
    const parsedRows = parseTabularRows(rows);
    if (parsedRows.length === 0) {
      throw new Error('NO_ROWS');
    }
    return buildResultFromRows(parsedRows, kind === 'csv' ? 'csv_import' : 'excel_import');
  }

  const pdf = (await import('pdf-parse')).default;
  const pdfData = await pdf(buffer);
  const text = String(pdfData.text || '').trim();
  if (text.length < 8) {
    throw new Error('PDF_EMPTY');
  }
  return buildResultFromText(text, 'pdf_text');
}

export const RECEIPT_MAX_BYTES = MAX_FILE_BYTES;

export const RECEIPT_ACCEPT_LABEL =
  'JPG, PNG, WEBP, PDF, CSV, XLSX, XLS · max 5MB';
