'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Upload, Check, AlertCircle, ArrowLeft, Sparkles, AlertTriangle, X } from 'lucide-react';
import { uploadReceipt, ParsedReceipt } from '../../../../services/receipt.service';
import { expenseService } from '../../../../services/expense.service';
import { ApiError } from '../../../../lib/api';
import { notifyLedgerChanged } from '../../../../lib/ledger-events';

const CATEGORIES = [
  'Food',
  'Transport',
  'Rent',
  'Bills',
  'Education',
  'Healthcare',
  'Shopping',
  'Entertainment',
  'Travel',
  'Utilities',
  'Other',
] as const;

const PAYMENT_METHODS = ['Cash', 'Debit Card', 'Credit Card', 'Bank Transfer', 'Mobile Wallet', 'Other'] as const;

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const RECEIPT_ACCEPT =
  'image/jpeg,image/jpg,image/png,image/webp,application/pdf,text/csv,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,.xls';
const RECEIPT_FORMATS_LABEL = 'JPG, PNG, WEBP, PDF, CSV, XLSX, XLS · max 5MB';

function displayValue(value: string | number | null | undefined, prefix = '') {
  if (value === null || value === undefined || value === '') return 'Not detected';
  if (typeof value === 'number') return `${prefix}${value.toLocaleString()}`;
  return `${prefix}${value}`;
}

function confidenceLabel(confidence: number) {
  if (confidence >= 0.85) return 'High';
  if (confidence >= 0.65) return 'Medium';
  return 'Low';
}

export default function ReceiptScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [scanning, setScanning] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    amount: '',
    subtotal: '',
    tax: '',
    description: '',
    category: 'Other',
    date: '',
    time: '',
    paymentMethod: '',
    transactionType: 'NEED' as 'NEED' | 'WANT',
  });

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
    setCameraStarting(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const applyParsedReceipt = (receipt: ParsedReceipt) => {
    setParsed(receipt);
    setForm({
      amount: receipt.totalAmount.value !== null ? String(receipt.totalAmount.value) : '',
      subtotal: receipt.subtotal.value !== null ? String(receipt.subtotal.value) : '',
      tax: receipt.tax.value !== null ? String(receipt.tax.value) : '',
      description: receipt.description.value || receipt.merchantName.value || '',
      category: receipt.category.value || 'Other',
      date: receipt.receiptDate.value || '',
      time: receipt.receiptTime.value || '',
      paymentMethod: receipt.paymentMethod.value || '',
      transactionType: 'NEED',
    });
  };

  const validateFile = (selectedFile: File) => {
    if (selectedFile.size > MAX_FILE_BYTES) {
      setError('File is too large. Maximum size is 5MB.');
      return false;
    }
    return true;
  };

  const handleFileChange = async (selectedFile: File) => {
    if (!validateFile(selectedFile)) return;

    stopCamera();
    setScanning(true);
    setError('');
    setParsed(null);

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const isImage = selectedFile.type.startsWith('image/');
    setPreviewUrl(isImage ? URL.createObjectURL(selectedFile) : null);

    try {
      const res = await uploadReceipt(selectedFile);
      applyParsedReceipt(res.receipt);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Receipt parsing failed. Try a clearer image.');
      setPreviewUrl(null);
    } finally {
      setScanning(false);
    }
  };

  const startCamera = async () => {
    setError('');
    setCameraStarting(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click();
      setCameraStarting(false);
      return;
    }

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(async () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraStarting(false);
      });
    } catch {
      setCameraStarting(false);
      cameraInputRef.current?.click();
    }
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setError('Camera is not ready yet. Wait a moment and try again.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Unable to capture photo from camera.');
      return;
    }

    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('Unable to capture photo from camera.');
          return;
        }
        const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' });
        void handleFileChange(file);
      },
      'image/jpeg',
      0.92
    );
  };

  const handleSave = async () => {
    if (!form.amount || !form.description) {
      setError('Provide amount and description before saving.');
      return;
    }
    if (!form.date) {
      setError('Receipt date is required. Enter the date printed on the receipt.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await expenseService.create({
        amount: parseFloat(form.amount),
        description: form.description,
        category: form.category as (typeof CATEGORIES)[number],
        date: form.date,
        paymentMethod: (form.paymentMethod || 'Other') as (typeof PAYMENT_METHODS)[number],
        transactionType: form.transactionType,
        recurring: false,
      });
      notifyLedgerChanged();
      router.push('/expenses');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save scanned expense.');
      setSaving(false);
    }
  };

  const resetScan = () => {
    stopCamera();
    setParsed(null);
    setError('');
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  return (
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        <div className="flex items-center gap-3 p-6 rounded-xl bg-slate-900 border border-slate-800">
          <button
            onClick={() => router.push('/expenses')}
            className="p-2 text-slate-400 hover:text-slate-100 rounded-md hover:bg-slate-800 transition-colors border border-slate-800"
            title="Back to Expenses"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="typo-overline text-slate-400">Accounts</p>
            <h1 className="text-2xl font-display font-semibold text-slate-100 mt-1">AI Receipt Scanner</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Use your camera for photos, or upload PDF, Excel, or CSV receipts up to 5MB.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!parsed ? (
          <div className="space-y-6">
            {cameraOpen ? (
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-100">Camera preview</h3>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="p-2 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                    title="Close camera"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="relative overflow-hidden rounded-xl bg-black border border-slate-800 aspect-[4/3] max-h-[480px]">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                </div>
                <p className="text-xs text-slate-400 text-center">
                  Hold the receipt flat, keep it in frame, and tap capture when the text is readable.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => void capturePhoto()}
                    disabled={scanning}
                    className="flex-1 py-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    {scanning ? 'Scanning…' : 'Capture & Scan'}
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="flex-1 py-3 rounded-md border border-slate-800 text-slate-300 hover:bg-slate-950 font-medium text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-12 rounded-xl bg-slate-900 border-2 border-dashed border-slate-700 text-center space-y-5 hover:border-emerald-500/40 transition-all">
                {previewUrl && scanning ? (
                  <div className="space-y-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="Receipt preview" className="mx-auto max-h-64 rounded-lg border border-slate-800 object-contain" />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                    <Camera className="w-8 h-8" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">Scan with camera or upload a file</h3>
                  <p className="text-xs text-slate-400 mt-1">Supports {RECEIPT_FORMATS_LABEL}</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => void startCamera()}
                    disabled={scanning || cameraStarting}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" />
                    {cameraStarting ? 'Opening camera…' : 'Open Camera'}
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={scanning}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-slate-800 hover:bg-slate-950 text-slate-100 font-medium text-sm transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    Upload File
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={RECEIPT_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) void handleFileChange(e.target.files[0]);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) void handleFileChange(e.target.files[0]);
                    e.target.value = '';
                  }}
                />
                {scanning && (
                  <div className="pt-2 text-xs font-medium text-emerald-400 animate-pulse flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    <span>Reading receipt and extracting fields…</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {previewUrl && (
              <div className="lg:col-span-2 p-4 rounded-xl bg-slate-900 border border-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Scanned receipt" className="mx-auto max-h-56 rounded-lg object-contain" />
              </div>
            )}

            <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Extracted receipt data</span>
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                    parsed.confidence >= 0.85
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : parsed.confidence >= 0.65
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}
                >
                  {Math.round(parsed.confidence * 100)}% · {confidenceLabel(parsed.confidence)}
                </span>
              </div>

              {parsed.reviewRequired && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Please review the extracted fields carefully before saving.</span>
                </div>
              )}

              {parsed.warnings.length > 0 && (
                <div className="space-y-2">
                  {parsed.warnings.map((warning) => (
                    <div key={warning} className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                      {warning}
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 text-sm">
                {[
                  ['Merchant', displayValue(parsed.merchantName.value), parsed.merchantName.confidence],
                  ['Total Amount', displayValue(parsed.totalAmount.value, 'Rs. '), parsed.totalAmount.confidence],
                  ['Subtotal', displayValue(parsed.subtotal.value, 'Rs. '), parsed.subtotal.confidence],
                  ['Tax', displayValue(parsed.tax.value, 'Rs. '), parsed.tax.confidence],
                  ['Discount', displayValue(parsed.discount.value, 'Rs. '), parsed.discount.confidence],
                  ['Date', displayValue(parsed.receiptDate.value), parsed.receiptDate.confidence],
                  ['Time', displayValue(parsed.receiptTime.value), parsed.receiptTime.confidence],
                  ['Category', displayValue(parsed.category.value), parsed.category.confidence],
                  ['Payment Method', displayValue(parsed.paymentMethod.value), parsed.paymentMethod.confidence],
                  ['Description', displayValue(parsed.description.value), parsed.description.confidence],
                ].map(([label, value, confidence]) => (
                  <div key={label} className="flex justify-between gap-4 py-1 border-b border-slate-800">
                    <span className="text-slate-400 font-medium">{label}</span>
                    <div className="text-right">
                      <span className="font-semibold text-slate-100">{value}</span>
                      <p className="text-[10px] text-slate-500">
                        {Number(confidence) > 0 ? `${Math.round(Number(confidence) * 100)}% field confidence` : 'Not detected'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {parsed.categoryReason && (
                <p className="text-xs text-slate-500">Category reason: {parsed.categoryReason}</p>
              )}

              {parsed.lineItems.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Line items</p>
                  <div className="space-y-2 text-xs bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                    {parsed.lineItems.map((item, idx) => (
                      <div key={`${item.name}-${idx}`} className="flex justify-between gap-3 text-slate-300">
                        <div>
                          <p className="font-medium text-slate-100">{item.name}</p>
                          {(item.quantity !== null || item.unitPrice !== null) && (
                            <p className="text-slate-500">
                              {item.quantity !== null ? `Qty ${item.quantity}` : ''}
                              {item.unitPrice !== null ? ` · Unit Rs. ${item.unitPrice.toLocaleString()}` : ''}
                            </p>
                          )}
                        </div>
                        <span className="font-semibold text-slate-100">
                          {item.totalPrice !== null ? `Rs. ${item.totalPrice.toLocaleString()}` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-slate-100">Review &amp; confirm transaction</h3>
                <p className="text-xs text-slate-400">
                  Edit any field below. Saved values come from your edits, not the original extraction.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-300 mb-1.5">Description / Merchant</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full p-3 rounded-md border border-slate-800 bg-slate-950 text-slate-100 text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-slate-300 mb-1.5">Total Amount (Rs.)</label>
                    <input
                      type="number"
                      step="any"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      className="w-full p-3 rounded-md border border-slate-800 bg-slate-950 text-slate-100 text-sm focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-300 mb-1.5">Subtotal (Rs.)</label>
                    <input
                      type="number"
                      step="any"
                      value={form.subtotal}
                      onChange={(e) => setForm({ ...form, subtotal: e.target.value })}
                      className="w-full p-3 rounded-md border border-slate-800 bg-slate-950 text-slate-100 text-sm focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-300 mb-1.5">Tax (Rs.)</label>
                    <input
                      type="number"
                      step="any"
                      value={form.tax}
                      onChange={(e) => setForm({ ...form, tax: e.target.value })}
                      className="w-full p-3 rounded-md border border-slate-800 bg-slate-950 text-slate-100 text-sm focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-300 mb-1.5">Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full p-3 rounded-md border border-slate-800 bg-slate-950 text-slate-100 text-sm focus:outline-none focus:border-emerald-500/50"
                    >
                      {CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-300 mb-1.5">Payment Method</label>
                    <select
                      value={form.paymentMethod}
                      onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                      className="w-full p-3 rounded-md border border-slate-800 bg-slate-950 text-slate-100 text-sm focus:outline-none focus:border-emerald-500/50"
                    >
                      <option value="">Not detected / select manually</option>
                      {PAYMENT_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-300 mb-1.5">Receipt Date</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="w-full p-3 rounded-md border border-slate-800 bg-slate-950 text-slate-100 text-sm focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-300 mb-1.5">Receipt Time</label>
                    <input
                      type="time"
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                      className="w-full p-3 rounded-md border border-slate-800 bg-slate-950 text-slate-100 text-sm focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1.5">Need vs Want</label>
                  <select
                    value={form.transactionType}
                    onChange={(e) => setForm({ ...form, transactionType: e.target.value as 'NEED' | 'WANT' })}
                    className="w-full p-3 rounded-md border border-slate-800 bg-slate-950 text-slate-100 text-sm focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="NEED">Need</option>
                    <option value="WANT">Want</option>
                  </select>
                </div>

                <div className="pt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={resetScan}
                    className="flex-1 py-3 rounded-md border border-slate-800 text-slate-300 hover:bg-slate-950 font-medium transition-colors text-sm"
                  >
                    Rescan
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="flex-1 py-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                  >
                    <Check className="w-4 h-4" />
                    <span>{saving ? 'Saving…' : 'Confirm & Save'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
