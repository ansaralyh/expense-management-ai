import * as XLSX from 'xlsx';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const INCOME_REQUIRED = [
  { key: 'amount', aliases: ['amount', 'income', 'value'] },
  { key: 'source', aliases: ['source', 'incomesource', 'from'] },
  { key: 'date', aliases: ['date', 'transactiondate', 'incomedate'] },
  { key: 'incomeType', aliases: ['incometype', 'type', 'category'] },
] as const;

const EXPENSE_REQUIRED = [
  { key: 'amount', aliases: ['amount', 'expense', 'value', 'cost'] },
  { key: 'description', aliases: ['description', 'details', 'note', 'notes'] },
  { key: 'category', aliases: ['category', 'expensecategory'] },
  { key: 'date', aliases: ['date', 'transactiondate', 'expensedate'] },
  { key: 'paymentMethod', aliases: ['paymentmethod', 'payment', 'method'] },
  { key: 'transactionType', aliases: ['transactiontype', 'needwant', 'needorwant', 'type'] },
] as const;

export type LocalImportRow = {
  row: number;
  sheet: string;
  kind: 'income' | 'expense';
  date: string;
  amount: number | null;
  type: string;
  label: string;
  detail?: string;
};

export type LocalImportPreview = {
  fileName: string;
  sheetKind: 'income' | 'expense' | 'mixed' | 'unknown';
  rows: LocalImportRow[];
  incomeCount: number;
  expenseCount: number;
  incomeTotal: number;
  expenseTotal: number;
  missingHeaders: string[];
  structureErrors: string[];
  structureValid: boolean;
  hasData: boolean;
  canSend: boolean;
};

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function headerIndex(headers: string[], aliases: readonly string[]) {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const index = normalized.indexOf(normalizeHeader(alias));
    if (index >= 0) return index;
  }
  return -1;
}

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value ?? '')
    .replace(/,/g, '')
    .replace(/rs\.?/gi, '')
    .trim();
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

function parseDateValue(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }
  const text = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const slash = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slash) {
    const [, day, month, year] = slash;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return text;
}

function detectSheetKind(headers: string[]): 'income' | 'expense' | 'unknown' {
  const normalized = headers.map(normalizeHeader);
  const has = (aliases: readonly string[]) =>
    aliases.some((alias) => normalized.includes(normalizeHeader(alias)));

  if (has(['incometype', 'income type'])) return 'income';
  if (has(['category', 'paymentmethod', 'payment method', 'transactiontype', 'transaction type'])) {
    return 'expense';
  }
  if (has(['source']) && !has(['category'])) return 'income';
  if (has(['description']) && has(['category'])) return 'expense';
  return 'unknown';
}

function missingRequiredHeaders(headers: string[], kind: 'income' | 'expense') {
  const required = kind === 'income' ? INCOME_REQUIRED : EXPENSE_REQUIRED;
  return required
    .filter((field) => headerIndex(headers, field.aliases) < 0)
    .map((field) => field.key);
}

function sheetRows(sheet: XLSX.WorkSheet) {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];
}

function parseIncomeRows(sheetName: string, rows: unknown[][]): LocalImportRow[] {
  if (rows.length === 0) return [];
  const headers = rows[0].map((cell) => String(cell ?? ''));
  const amountIdx = headerIndex(headers, INCOME_REQUIRED[0].aliases);
  const sourceIdx = headerIndex(headers, INCOME_REQUIRED[1].aliases);
  const dateIdx = headerIndex(headers, INCOME_REQUIRED[2].aliases);
  const typeIdx = headerIndex(headers, INCOME_REQUIRED[3].aliases);

  const parsed: LocalImportRow[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.every((cell) => String(cell ?? '').trim() === '')) continue;
    parsed.push({
      row: i + 1,
      sheet: sheetName,
      kind: 'income',
      date: parseDateValue(row[dateIdx]),
      amount: parseAmount(row[amountIdx]),
      type: String(row[typeIdx] ?? '').trim() || '—',
      label: String(row[sourceIdx] ?? '').trim() || '—',
    });
  }
  return parsed;
}

function parseExpenseRows(sheetName: string, rows: unknown[][]): LocalImportRow[] {
  if (rows.length === 0) return [];
  const headers = rows[0].map((cell) => String(cell ?? ''));
  const amountIdx = headerIndex(headers, EXPENSE_REQUIRED[0].aliases);
  const descriptionIdx = headerIndex(headers, EXPENSE_REQUIRED[1].aliases);
  const categoryIdx = headerIndex(headers, EXPENSE_REQUIRED[2].aliases);
  const dateIdx = headerIndex(headers, EXPENSE_REQUIRED[3].aliases);
  const paymentIdx = headerIndex(headers, EXPENSE_REQUIRED[4].aliases);
  const typeIdx = headerIndex(headers, EXPENSE_REQUIRED[5].aliases);

  const parsed: LocalImportRow[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.every((cell) => String(cell ?? '').trim() === '')) continue;
    parsed.push({
      row: i + 1,
      sheet: sheetName,
      kind: 'expense',
      date: parseDateValue(row[dateIdx]),
      amount: parseAmount(row[amountIdx]),
      type: String(row[categoryIdx] ?? '').trim() || '—',
      label: String(row[descriptionIdx] ?? '').trim() || '—',
      detail: [String(row[paymentIdx] ?? '').trim(), String(row[typeIdx] ?? '').trim()]
        .filter(Boolean)
        .join(' · '),
    });
  }
  return parsed;
}

function readWorkbook(buffer: ArrayBuffer) {
  return XLSX.read(buffer, { type: 'array', cellDates: true });
}

function findSheet(workbook: XLSX.WorkBook, names: string[]) {
  const targets = names.map((name) => name.toLowerCase());
  return workbook.SheetNames.find((name) => targets.includes(name.toLowerCase()));
}

export function validateImportFile(file: File): string | null {
  const lower = file.name.toLowerCase();
  const allowed =
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    lower.endsWith('.csv') ||
    file.type.includes('spreadsheet') ||
    file.type.includes('excel') ||
    file.type === 'text/csv';
  if (!allowed) {
    return 'Upload an Excel workbook (.xlsx, .xls) or CSV file.';
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'File is too large. Maximum size is 5 MB.';
  }
  if (file.size === 0) {
    return 'The selected file is empty.';
  }
  return null;
}

export async function parseImportFile(file: File): Promise<LocalImportPreview> {
  const fileError = validateImportFile(file);
  if (fileError) {
    return {
      fileName: file.name,
      sheetKind: 'unknown',
      rows: [],
      incomeCount: 0,
      expenseCount: 0,
      incomeTotal: 0,
      expenseTotal: 0,
      missingHeaders: [],
      structureErrors: [fileError],
      structureValid: false,
      hasData: false,
      canSend: false,
    };
  }

  const buffer = await file.arrayBuffer();
  const workbook = readWorkbook(buffer);
  const incomeSheetName = findSheet(workbook, ['Income', 'Incomes']);
  const expenseSheetName = findSheet(workbook, ['Expenses', 'Expense']);

  let incomeRows: LocalImportRow[] = [];
  let expenseRows: LocalImportRow[] = [];
  const structureErrors: string[] = [];
  const missingHeaders: string[] = [];

  if (incomeSheetName) {
    const rows = sheetRows(workbook.Sheets[incomeSheetName]);
    const headers = rows[0]?.map((cell) => String(cell ?? '')) ?? [];
    missingHeaders.push(...missingRequiredHeaders(headers, 'income').map((h) => `Income.${h}`));
    incomeRows = parseIncomeRows(incomeSheetName, rows);
  }

  if (expenseSheetName) {
    const rows = sheetRows(workbook.Sheets[expenseSheetName]);
    const headers = rows[0]?.map((cell) => String(cell ?? '')) ?? [];
    missingHeaders.push(...missingRequiredHeaders(headers, 'expense').map((h) => `Expenses.${h}`));
    expenseRows = parseExpenseRows(expenseSheetName, rows);
  }

  if (!incomeSheetName && !expenseSheetName) {
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) {
      structureErrors.push('The file has no sheets or rows.');
    } else {
      const rows = sheetRows(workbook.Sheets[firstSheet]);
      const headers = rows[0]?.map((cell) => String(cell ?? '')) ?? [];
      const kind = detectSheetKind(headers);
      if (kind === 'income') {
        missingHeaders.push(...missingRequiredHeaders(headers, 'income'));
        incomeRows = parseIncomeRows(firstSheet, rows);
      } else if (kind === 'expense') {
        missingHeaders.push(...missingRequiredHeaders(headers, 'expense'));
        expenseRows = parseExpenseRows(firstSheet, rows);
      } else {
        structureErrors.push(
          'Could not detect SmartFin format. Use Income columns (amount, source, date, incomeType) or Expense columns (amount, description, category, date, paymentMethod, transactionType).'
        );
      }
    }
  }

  if (missingHeaders.length > 0) {
    structureErrors.push(`Missing required columns: ${missingHeaders.join(', ')}`);
  }

  const rows = [...incomeRows, ...expenseRows];
  const incomeTotal = incomeRows.reduce((sum, row) => sum + (row.amount || 0), 0);
  const expenseTotal = expenseRows.reduce((sum, row) => sum + (row.amount || 0), 0);
  const sheetKind: LocalImportPreview['sheetKind'] =
    incomeRows.length > 0 && expenseRows.length > 0
      ? 'mixed'
      : incomeRows.length > 0
        ? 'income'
        : expenseRows.length > 0
          ? 'expense'
          : 'unknown';

  const hasData = rows.length > 0;
  const structureValid = structureErrors.length === 0 && missingHeaders.length === 0;

  return {
    fileName: file.name,
    sheetKind,
    rows,
    incomeCount: incomeRows.length,
    expenseCount: expenseRows.length,
    incomeTotal,
    expenseTotal,
    missingHeaders,
    structureErrors,
    structureValid,
    hasData,
    canSend: structureValid && hasData,
  };
}

export function formatImportValidationError(preview: LocalImportPreview) {
  if (preview.structureErrors.length > 0) return preview.structureErrors[0];
  if (!preview.hasData) return 'No data rows were found in the file.';
  return 'The file does not match the SmartFin import format.';
}
