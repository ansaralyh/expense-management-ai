import { AppError } from '../../utils/AppError.js';
import { config } from '../../config/env.js';
import { inferReceiptCategory } from './receipt.category.js';
import {
  buildReceiptWarnings,
  extractTotalFromOcrText,
  overallConfidence,
  parseMoney,
  parseReceiptDate,
  parseReceiptTime,
  sanitizeLineItems,
  unwrapVisionField,
  validateImageInput,
} from './receipt.validation.js';
import {
  detectReceiptFileKind,
  parseReceiptDocument,
  validateReceiptFile,
} from './receipt.document.js';
import { ExpenseCategory } from '../expense/expense.model.js';
import { ExtractedField, ReceiptScanResult, VisionReceiptPayload } from './receipt.types.js';

const VISION_SYSTEM_PROMPT = `You are a receipt OCR and extraction engine for SmartFin.
Analyze ONLY the uploaded receipt image. Extract what is actually visible.

Rules:
- Never invent merchant names, amounts, dates, tax, payment methods, or line items.
- If a field is missing or unreadable, return null for its value and a low confidence.
- Identify the final payable amount using labels such as Total, Grand Total, Net Total, Amount Due, Amount Payable, Balance Due.
- Do NOT use subtotal, tax alone, or random large numbers as totalAmount.
- Normalize receiptDate to YYYY-MM-DD only when clearly readable.
- Do NOT default to today's date.
- Currency should be PKR/Rs. only if visible or clearly implied by the receipt locale.
- Category must be one of: Food, Transport, Rent, Bills, Education, Healthcare, Shopping, Entertainment, Travel, Utilities, Other.
- Prefer Healthcare for pharmacies/medicine, Education for tuition/university fees, Utilities/Bills for utility bills, Food for restaurants/groceries.
- Return JSON only in this shape:
{
  "ocrText": "full visible text transcription",
  "merchantName": { "value": "Store Name or null", "confidence": 0.0 },
  "totalAmount": { "value": 1130, "confidence": 0.0 },
  "currency": { "value": "PKR", "confidence": 0.0 },
  "subtotal": { "value": null, "confidence": 0.0 },
  "tax": { "value": null, "confidence": 0.0 },
  "discount": { "value": null, "confidence": 0.0 },
  "receiptDate": { "value": "YYYY-MM-DD or null", "confidence": 0.0 },
  "receiptTime": { "value": "HH:MM or null", "confidence": 0.0 },
  "category": { "value": "Healthcare", "confidence": 0.0 },
  "paymentMethod": { "value": "Cash or null", "confidence": 0.0 },
  "description": { "value": "short purchase summary or null", "confidence": 0.0 },
  "lineItems": [
    { "name": "Item", "quantity": 1, "unitPrice": 500, "totalPrice": 500 }
  ]
}`;

function buildDataUri(fileBuffer: Buffer, fileName?: string, mimeType?: string) {
  const mime =
    mimeType ||
    (fileName?.toLowerCase().endsWith('.png')
      ? 'image/png'
      : fileName?.toLowerCase().endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg');
  return `data:${mime};base64,${fileBuffer.toString('base64')}`;
}

function adjustTotalWithOcr(
  totalAmount: ExtractedField<number>,
  ocrText: string,
  parsingNotes: string[]
): ExtractedField<number> {
  const labeled = extractTotalFromOcrText(ocrText);
  if (labeled.value === null) return totalAmount;

  if (totalAmount.value === null) {
    parsingNotes.push(`Total inferred from OCR label "${labeled.label}".`);
    return { value: labeled.value, confidence: 0.72 };
  }

  const delta = Math.abs(labeled.value - totalAmount.value);
  const tolerance = Math.max(5, labeled.value * 0.03);
  if (delta > tolerance) {
    parsingNotes.push(
      `Vision total Rs. ${totalAmount.value} differed from OCR label "${labeled.label}" Rs. ${labeled.value}; using labeled total.`
    );
    return { value: labeled.value, confidence: Math.min(totalAmount.confidence, 0.75) };
  }

  parsingNotes.push(`Total confirmed against OCR label "${labeled.label}".`);
  return totalAmount;
}

function buildDescription(
  merchantName: ExtractedField<string>,
  lineItems: ReturnType<typeof sanitizeLineItems>,
  aiDescription: ExtractedField<string>
): ExtractedField<string> {
  if (aiDescription.value) return aiDescription;
  if (lineItems.length > 0) {
    const names = lineItems.slice(0, 3).map((item) => item.name).join(', ');
    return {
      value: merchantName.value ? `${merchantName.value} — ${names}` : names,
      confidence: Math.max(merchantName.confidence, 0.55),
    };
  }
  if (merchantName.value) {
    return { value: `${merchantName.value} purchase`, confidence: merchantName.confidence * 0.8 };
  }
  return { value: null, confidence: 0 };
}

function normalizePaymentMethod(raw: string | null): ExtractedField<string> {
  if (!raw) return { value: null, confidence: 0 };
  const text = raw.trim().toLowerCase();
  if (text.includes('cash')) return { value: 'Cash', confidence: 0.9 };
  if (text.includes('credit')) return { value: 'Credit Card', confidence: 0.88 };
  if (text.includes('debit')) return { value: 'Debit Card', confidence: 0.88 };
  if (text.includes('wallet') || text.includes('easypaisa') || text.includes('jazzcash')) {
    return { value: 'Mobile Wallet', confidence: 0.85 };
  }
  if (text.includes('bank') || text.includes('transfer')) return { value: 'Bank Transfer', confidence: 0.85 };
  return { value: raw.trim(), confidence: 0.6 };
}

function enrichVisionPayload(payload: VisionReceiptPayload): ReceiptScanResult {
  const parsingNotes: string[] = [];
  const ocrText = String(payload.ocrText || '').trim();

  let merchantName = unwrapVisionField(payload.merchantName, (value) => {
    const text = String(value || '').trim();
    return text.length >= 2 ? text : null;
  }, 0.85);

  let totalAmount = unwrapVisionField(payload.totalAmount, parseMoney, 0.9);
  const subtotal = unwrapVisionField(payload.subtotal, parseMoney, 0.75);
  const tax = unwrapVisionField(payload.tax, parseMoney, 0.75);
  const discount = unwrapVisionField(payload.discount, parseMoney, 0.75);
  const receiptDateRaw = unwrapVisionField(payload.receiptDate, (value) => String(value || '').trim() || null, 0.85);
  const receiptDate = parseReceiptDate(receiptDateRaw.value);
  if (receiptDate.value && receiptDateRaw.confidence > receiptDate.confidence) {
    receiptDate.confidence = receiptDateRaw.confidence;
  }

  const receiptTimeRaw = unwrapVisionField(payload.receiptTime, (value) => String(value || '').trim() || null, 0.75);
  const receiptTime = parseReceiptTime(receiptTimeRaw.value);
  if (receiptTime.value && receiptTimeRaw.confidence > receiptTime.confidence) {
    receiptTime.confidence = receiptTimeRaw.confidence;
  }

  const currency = unwrapVisionField(payload.currency, (value) => {
    const text = String(value || '').trim();
    return text ? text.toUpperCase() : null;
  }, 0.7);

  const lineItems = sanitizeLineItems(payload.lineItems);
  totalAmount = adjustTotalWithOcr(totalAmount, ocrText, parsingNotes);

  const aiCategory = unwrapVisionField(payload.category, (value) => String(value || '').trim() || null, 0.75);
  const categoryInference = inferReceiptCategory({
    merchant: merchantName.value,
    lineItems,
    ocrText,
    aiCategory: aiCategory.value,
  });

  const paymentMethod = normalizePaymentMethod(
    unwrapVisionField(payload.paymentMethod, (value) => String(value || '').trim() || null, 0.75).value
  );

  const description = buildDescription(
    merchantName,
    lineItems,
    unwrapVisionField(payload.description, (value) => String(value || '').trim() || null, 0.7)
  );

  const category: ExtractedField<ExpenseCategory> = {
    value: categoryInference.category,
    confidence: categoryInference.confidence,
  };

  const warnings = buildReceiptWarnings({
    totalAmount,
    subtotal,
    tax,
    discount,
    receiptDate,
    merchantName,
    lineItems,
  });

  if (ocrText.length < 20) {
    warnings.push('Very little text was detected. The image may be blurry or cropped.');
  }

  const confidence = overallConfidence([
    merchantName,
    totalAmount,
    receiptDate,
    category,
    subtotal,
    tax,
    paymentMethod,
  ]);

  const reviewRequired =
    totalAmount.value === null ||
    merchantName.value === null ||
    confidence < 0.65 ||
    warnings.length > 0;

  const result: ReceiptScanResult = {
    merchantName,
    totalAmount,
    currency,
    subtotal,
    tax,
    discount,
    receiptDate,
    receiptTime,
    category,
    paymentMethod,
    description,
    lineItems,
    confidence,
    warnings,
    reviewRequired,
    extractionSource: 'openai_vision',
    categoryReason: categoryInference.reason,
  };

  if (config.nodeEnv === 'development') {
    result.debug = {
      ocrTextPreview: ocrText.slice(0, 500),
      totalLabelUsed: extractTotalFromOcrText(ocrText).label,
      parsingNotes,
    };
  }

  return result;
}

async function parseWithOpenAIVision(base64DataUrl: string): Promise<ReceiptScanResult> {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new AppError(
      'Receipt scanning requires an AI vision API key. Set AI_API_KEY or OPENAI_API_KEY in the backend environment.',
      503
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: VISION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all visible receipt fields from this image. Return null for anything not clearly present.',
              },
              { type: 'image_url', image_url: { url: base64DataUrl, detail: 'high' } },
            ],
          },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AppError(
        body.includes('invalid_api_key')
          ? 'Receipt scanning AI key is invalid. Check AI_API_KEY in the backend environment.'
          : 'Receipt vision service failed to analyze the image. Try again with a clearer photo.',
        502
      );
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new AppError('Receipt vision service returned an empty response.', 502);
    }

    const payload = JSON.parse(content) as VisionReceiptPayload;
    return enrichVisionPayload(payload);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError('Receipt scanning timed out. Try again with a smaller or clearer image.', 504);
    }
    throw new AppError(
      'Could not extract data from this receipt image. Upload a clearer, well-lit photo with the total visible.',
      422
    );
  } finally {
    clearTimeout(timer);
  }
}

function mapDocumentError(error: unknown): never {
  const code = error instanceof Error ? error.message : '';
  if (code === 'TOO_LARGE') {
    throw new AppError('File is too large. Maximum size is 5MB.', 400);
  }
  if (code === 'UNSUPPORTED') {
    throw new AppError(
      'Unsupported file type. Use JPG, PNG, WEBP, PDF, CSV, XLSX, or XLS up to 5MB.',
      400
    );
  }
  if (code === 'NO_ROWS') {
    throw new AppError(
      'No expense rows with an amount were found in the spreadsheet or CSV. Check the column headers and try again.',
      422
    );
  }
  if (code === 'PDF_EMPTY') {
    throw new AppError(
      'Could not read text from this PDF. Try a clearer PDF or upload a photo of the receipt instead.',
      422
    );
  }
  if (code === 'EMPTY') {
    throw new AppError('Upload a receipt file before scanning.', 400);
  }
  throw new AppError('Could not parse this receipt file. Try another format or enter the expense manually.', 422);
}

export async function parseReceiptData(
  fileBuffer?: Buffer,
  base64Image?: string,
  fileName?: string,
  mimeType?: string
): Promise<ReceiptScanResult> {
  if (!fileBuffer && !base64Image) {
    throw new AppError('Upload a receipt file before scanning.', 400);
  }

  let buffer = fileBuffer;
  if (!buffer && base64Image) {
    const match = base64Image.match(/^data:(.+);base64,(.+)$/);
    if (match) {
      buffer = Buffer.from(match[2], 'base64');
      mimeType = mimeType || match[1];
    }
  }

  if (!buffer) {
    throw new AppError('Upload a receipt file before scanning.', 400);
  }

  let kind;
  try {
    kind = validateReceiptFile(buffer, mimeType, fileName);
  } catch (error) {
    mapDocumentError(error);
  }

  if (kind === 'pdf' || kind === 'csv' || kind === 'excel') {
    try {
      return await parseReceiptDocument(buffer, kind, fileName);
    } catch (error) {
      mapDocumentError(error);
    }
  }

  validateImageInput(buffer, mimeType, fileName);

  const base64Uri =
    base64Image && base64Image.startsWith('data:')
      ? base64Image
      : buildDataUri(buffer, fileName, mimeType);

  const result = await parseWithOpenAIVision(base64Uri);

  if (result.totalAmount.value === null && result.merchantName.value === null && result.lineItems.length === 0) {
    throw new AppError(
      'Receipt image is too blurry to reliably extract details. Please upload a clearer image or enter the expense manually.',
      422
    );
  }

  return result;
}
