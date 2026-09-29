import { ExpenseCategory } from '../expense/expense.model.js';

export type ExtractedField<T> = {
  value: T | null;
  confidence: number;
};

export type ReceiptLineItem = {
  name: string;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
};

export type ReceiptScanResult = {
  merchantName: ExtractedField<string>;
  totalAmount: ExtractedField<number>;
  currency: ExtractedField<string>;
  subtotal: ExtractedField<number>;
  tax: ExtractedField<number>;
  discount: ExtractedField<number>;
  receiptDate: ExtractedField<string>;
  receiptTime: ExtractedField<string>;
  category: ExtractedField<ExpenseCategory>;
  paymentMethod: ExtractedField<string>;
  description: ExtractedField<string>;
  lineItems: ReceiptLineItem[];
  confidence: number;
  warnings: string[];
  reviewRequired: boolean;
  extractionSource: 'openai_vision' | 'pdf_text' | 'csv_import' | 'excel_import';
  categoryReason?: string;
  debug?: {
    ocrTextPreview?: string;
    totalLabelUsed?: string | null;
    parsingNotes?: string[];
  };
};

export type VisionFieldPayload<T> = {
  value?: T | null;
  confidence?: number | null;
};

export type VisionReceiptPayload = {
  ocrText?: string | null;
  merchantName?: VisionFieldPayload<string> | string | null;
  totalAmount?: VisionFieldPayload<number> | number | string | null;
  currency?: VisionFieldPayload<string> | string | null;
  subtotal?: VisionFieldPayload<number> | number | string | null;
  tax?: VisionFieldPayload<number> | number | string | null;
  discount?: VisionFieldPayload<number> | number | string | null;
  receiptDate?: VisionFieldPayload<string> | string | null;
  receiptTime?: VisionFieldPayload<string> | string | null;
  category?: VisionFieldPayload<string> | string | null;
  paymentMethod?: VisionFieldPayload<string> | string | null;
  description?: VisionFieldPayload<string> | string | null;
  lineItems?: Array<{
    name?: string | null;
    quantity?: number | string | null;
    unitPrice?: number | string | null;
    totalPrice?: number | string | null;
  }> | null;
};
