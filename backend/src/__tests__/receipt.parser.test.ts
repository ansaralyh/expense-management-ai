import { describe, expect, it } from 'vitest';
import { inferReceiptCategory } from '../modules/receipt/receipt.category.js';
import { detectReceiptFileKind, validateReceiptFile } from '../modules/receipt/receipt.document.js';
import {
  buildReceiptWarnings,
  extractTotalFromOcrText,
  overallConfidence,
  parseMoney,
  parseReceiptDate,
  parseReceiptTime,
  sanitizeLineItems,
} from '../modules/receipt/receipt.validation.js';

describe('receipt validation helpers', () => {
  it('parses money values with currency symbols and commas', () => {
    expect(parseMoney('Rs. 1,850')).toBe(1850);
    expect(parseMoney('PKR 1130.50')).toBe(1130.5);
    expect(parseMoney(null)).toBeNull();
  });

  it('parses receipt dates without defaulting to today', () => {
    expect(parseReceiptDate('24/09/2026').value).toBe('2026-09-24');
    expect(parseReceiptDate('2026-09-24').value).toBe('2026-09-24');
    expect(parseReceiptDate('').value).toBeNull();
  });

  it('parses receipt time values', () => {
    expect(parseReceiptTime('6:42 PM').value).toBe('18:42');
    expect(parseReceiptTime('').value).toBeNull();
  });

  it('extracts final total from OCR labels', () => {
    const text = 'Subtotal Rs. 1,000\nTax Rs. 180\nDiscount Rs. 50\nGrand Total Rs. 1,130';
    expect(extractTotalFromOcrText(text).value).toBe(1130);
  });

  it('flags math mismatches in warnings', () => {
    const warnings = buildReceiptWarnings({
      merchantName: { value: 'ABC Store', confidence: 0.9 },
      totalAmount: { value: 5000, confidence: 0.9 },
      subtotal: { value: 1000, confidence: 0.8 },
      tax: { value: 180, confidence: 0.8 },
      discount: { value: 50, confidence: 0.8 },
      receiptDate: { value: '2026-09-24', confidence: 0.9 },
      lineItems: [],
    });
    expect(warnings.some((warning) => warning.includes('does not match subtotal/tax math'))).toBe(true);
  });

  it('sanitizes line items without inventing names', () => {
    expect(
      sanitizeLineItems([
        { name: 'Medicine A', quantity: 2, unitPrice: 500, totalPrice: 1000 },
        { name: '', price: 100 },
      ])
    ).toEqual([{ name: 'Medicine A', quantity: 2, unitPrice: 500, totalPrice: 1000 }]);
  });

  it('calculates overall confidence from detected fields only', () => {
    expect(
      overallConfidence([
        { value: 'ABC Store', confidence: 0.9 },
        { value: 1850, confidence: 0.95 },
        { value: null, confidence: 0 },
      ])
    ).toBe(0.93);
  });
});

describe('receipt file types', () => {
  it('detects supported receipt file kinds', () => {
    expect(detectReceiptFileKind('application/pdf', 'bill.pdf')).toBe('pdf');
    expect(detectReceiptFileKind('text/csv', 'receipt.csv')).toBe('csv');
    expect(
      detectReceiptFileKind(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'receipt.xlsx'
      )
    ).toBe('excel');
    expect(detectReceiptFileKind('image/png', 'photo.png')).toBe('image');
  });

  it('rejects files larger than 5MB', () => {
    const large = Buffer.alloc(5 * 1024 * 1024 + 1);
    expect(() => validateReceiptFile(large, 'application/pdf', 'big.pdf')).toThrow('TOO_LARGE');
  });
});

describe('receipt category inference', () => {
  it('infers Healthcare for pharmacy receipts', () => {
    const result = inferReceiptCategory({
      merchant: 'ABC Pharmacy',
      lineItems: [{ name: 'Paracetamol', quantity: 1, unitPrice: 500, totalPrice: 500 }],
      ocrText: 'ABC Pharmacy\nParacetamol\nAntibiotic\nTotal Rs. 1,850',
      aiCategory: null,
    });
    expect(result.category).toBe('Healthcare');
    expect(result.category).not.toBe('Other');
  });

  it('infers Education for university fee receipts', () => {
    const result = inferReceiptCategory({
      merchant: 'City University',
      lineItems: [{ name: 'Semester Fee', quantity: 1, unitPrice: 45000, totalPrice: 45000 }],
      ocrText: 'University Fee\nSemester Fee\nTotal Rs. 45,000',
      aiCategory: 'Education',
    });
    expect(result.category).toBe('Education');
  });

  it('infers Utilities for electricity bills', () => {
    const result = inferReceiptCategory({
      merchant: 'K-Electric',
      lineItems: [],
      ocrText: 'Electricity Bill\nConsumer ID\nCurrent Bill\nAmount Due Rs. 12,500',
      aiCategory: null,
    });
    expect(result.category).toBe('Utilities');
  });
});
