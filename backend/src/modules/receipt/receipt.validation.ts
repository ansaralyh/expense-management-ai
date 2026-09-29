import { AppError } from '../../utils/AppError.js';
import { ExtractedField, ReceiptLineItem } from './receipt.types.js';

const SUPPORTED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MIN_IMAGE_BYTES = 4_096;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value >= 0 ? value : null;

  const text = String(value).trim();
  const matches = text.match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return null;

  const cleaned = matches[matches.length - 1].replace(/,/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseReceiptDate(raw: unknown): ExtractedField<string> {
  if (raw === null || raw === undefined) return { value: null, confidence: 0 };
  const text = String(raw).trim();
  if (!text) return { value: null, confidence: 0 };

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return { value: text, confidence: 0.95 };
  }

  const isoLike = text.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (isoLike) {
    const [, y, m, d] = isoLike;
    return { value: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`, confidence: 0.9 };
  }

  const dmy = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dmy) {
    const [, a, b, yearRaw] = dmy;
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    const first = Number(a);
    const second = Number(b);

    // Prefer DD/MM for Pakistan-style receipts when unambiguous.
    if (first > 12 && second <= 12) {
      return { value: `${year}-${String(second).padStart(2, '0')}-${String(first).padStart(2, '0')}`, confidence: 0.88 };
    }
    if (second > 12 && first <= 12) {
      return { value: `${year}-${String(first).padStart(2, '0')}-${String(second).padStart(2, '0')}`, confidence: 0.88 };
    }

    return {
      value: `${year}-${String(second).padStart(2, '0')}-${String(first).padStart(2, '0')}`,
      confidence: 0.65,
    };
  }

  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) {
    return { value: new Date(parsed).toISOString().slice(0, 10), confidence: 0.6 };
  }

  return { value: null, confidence: 0 };
}

export function parseReceiptTime(raw: unknown): ExtractedField<string> {
  if (raw === null || raw === undefined) return { value: null, confidence: 0 };
  const text = String(raw).trim();
  if (!text) return { value: null, confidence: 0 };

  const match = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return { value: null, confidence: 0 };

  let hours = Number(match[1]);
  const minutes = match[2];
  const meridiem = match[4]?.toLowerCase();
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  return {
    value: `${String(hours).padStart(2, '0')}:${minutes}`,
    confidence: meridiem ? 0.9 : 0.75,
  };
}

const TOTAL_LABEL_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Grand Total', pattern: /(?:grand\s+total|net\s+total|amount\s+due|amount\s+payable|balance\s+due|total\s+amount|total\s+payable|payable)[^\d]{0,20}(?:rs\.?|pkr)?\s*([\d,]+(?:\.\d+)?)/i },
  { label: 'Total', pattern: /(?:^|\n|\s)total[^\d]{0,12}(?:rs\.?|pkr)?\s*([\d,]+(?:\.\d+)?)/i },
];

export function extractTotalFromOcrText(ocrText: string): { value: number | null; label: string | null } {
  if (!ocrText.trim()) return { value: null, label: null };

  for (const row of TOTAL_LABEL_PATTERNS) {
    const match = ocrText.match(row.pattern);
    if (match) {
      const value = parseMoney(match[1]);
      if (value !== null && value > 0) {
        return { value, label: row.label };
      }
    }
  }

  return { value: null, label: null };
}

export function validateImageInput(fileBuffer?: Buffer, mimeType?: string, fileName?: string) {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new AppError('Upload a receipt image before scanning.', 400);
  }

  if (fileBuffer.length > MAX_IMAGE_BYTES) {
    throw new AppError('File is too large. Maximum size is 5MB.', 400);
  }

  if (fileBuffer.length < MIN_IMAGE_BYTES) {
    throw new AppError('Receipt image is too small or unreadable. Upload a clearer photo.', 400);
  }

  const mime = (mimeType || guessMimeFromName(fileName)).toLowerCase();
  if (!SUPPORTED_MIME.has(mime)) {
    throw new AppError('Unsupported image type. Upload JPG, PNG, or WEBP for camera/photo scans.', 400);
  }

  if (!hasValidImageSignature(fileBuffer, mime)) {
    throw new AppError('The uploaded file does not look like a valid image. Try another photo.', 400);
  }
}

function guessMimeFromName(fileName?: string) {
  const lower = (fileName || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function hasValidImageSignature(buffer: Buffer, mime: string) {
  if (mime.includes('png')) {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mime.includes('webp')) {
    return buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP';
  }
  return buffer[0] === 0xff && buffer[1] === 0xd8;
}

export function sanitizeLineItems(items: unknown): ReceiptLineItem[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const name = String(row.name || '').trim();
      if (!name) return null;
      return {
        name,
        quantity: parseMoney(row.quantity),
        unitPrice: parseMoney(row.unitPrice),
        totalPrice: parseMoney(row.totalPrice ?? row.price),
      };
    })
    .filter(Boolean) as ReceiptLineItem[];
}

export function buildReceiptWarnings(input: {
  totalAmount: ExtractedField<number>;
  subtotal: ExtractedField<number>;
  tax: ExtractedField<number>;
  discount: ExtractedField<number>;
  receiptDate: ExtractedField<string>;
  merchantName: ExtractedField<string>;
  lineItems: ReceiptLineItem[];
}): string[] {
  const warnings: string[] = [];

  if (input.totalAmount.value === null) {
    warnings.push('Total amount was not detected. Please enter it manually.');
  }

  if (input.merchantName.value === null) {
    warnings.push('Merchant name was not detected. Please enter it manually.');
  }

  if (input.receiptDate.value === null) {
    warnings.push('Receipt date was not detected. Please confirm the date before saving.');
  }

  const { subtotal, tax, discount, totalAmount } = input;
  if (
    subtotal.value !== null &&
    totalAmount.value !== null &&
    tax.value !== null
  ) {
    const expected = subtotal.value + tax.value - (discount.value || 0);
    const delta = Math.abs(expected - totalAmount.value);
    if (delta > Math.max(5, expected * 0.05)) {
      warnings.push(
        `Extracted total (Rs. ${totalAmount.value.toLocaleString()}) does not match subtotal/tax math (expected about Rs. ${Math.round(expected).toLocaleString()}). Please review.`
      );
    }
  }

  const lineTotal = input.lineItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  if (
    lineTotal > 0 &&
    totalAmount.value !== null &&
    Math.abs(lineTotal - totalAmount.value) > Math.max(10, totalAmount.value * 0.1) &&
    subtotal.value === null
  ) {
    warnings.push('Line item totals do not closely match the extracted total. Please review the amount.');
  }

  return warnings;
}

export function overallConfidence(fields: ExtractedField<unknown>[]): number {
  const scored = fields.filter((field) => field.value !== null && field.confidence > 0);
  if (scored.length === 0) return 0;
  const sum = scored.reduce((acc, field) => acc + field.confidence, 0);
  return Number((sum / scored.length).toFixed(2));
}

export function unwrapVisionField<T>(
  raw: unknown,
  parser: (value: unknown) => T | null,
  fallbackConfidence = 0.7
): ExtractedField<T> {
  if (raw === null || raw === undefined) return { value: null, confidence: 0 };

  if (typeof raw === 'object' && raw !== null && 'value' in (raw as Record<string, unknown>)) {
    const payload = raw as { value?: unknown; confidence?: unknown };
    const value = parser(payload.value);
    const confidence =
      typeof payload.confidence === 'number' && payload.confidence >= 0 && payload.confidence <= 1
        ? payload.confidence
        : value === null
          ? 0
          : fallbackConfidence;
    return { value, confidence };
  }

  const value = parser(raw);
  return { value, confidence: value === null ? 0 : fallbackConfidence };
}
