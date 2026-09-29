import { apiUpload } from '../lib/api';

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

export type ParsedReceipt = {
  merchantName: ExtractedField<string>;
  totalAmount: ExtractedField<number>;
  currency: ExtractedField<string>;
  subtotal: ExtractedField<number>;
  tax: ExtractedField<number>;
  discount: ExtractedField<number>;
  receiptDate: ExtractedField<string>;
  receiptTime: ExtractedField<string>;
  category: ExtractedField<string>;
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

export type ReceiptScanResponse = {
  status: string;
  receipt: ParsedReceipt;
  warnings: string[];
  reviewRequired: boolean;
};

export async function uploadReceipt(file: File): Promise<ReceiptScanResponse> {
  const formData = new FormData();
  formData.append('receipt', file);
  return apiUpload('/api/receipts/scan', formData);
}
