'use client';

import { DragEvent, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Wallet,
  Receipt,
  Sparkles,
  BarChart3,
  FileText,
  Loader2,
  CloudUpload,
  Send,
} from 'lucide-react';
import { importService, ImportCommitResponse, ImportPreviewResponse } from '../../../services/import.service';
import { ApiError } from '../../../lib/api';
import {
  formatImportValidationError,
  LocalImportPreview,
  parseImportFile,
} from '../../../lib/import-parser';
import { notifyLedgerChanged } from '../../../lib/ledger-events';

function formatRs(amount: number) {
  return `Rs. ${Math.round(amount).toLocaleString()}`;
}

const STEPS = [
  { id: 1, label: 'Download template' },
  { id: 2, label: 'Upload file' },
  { id: 3, label: 'Review preview' },
  { id: 4, label: 'Import rows' },
];

function activeStep(
  localPreview: LocalImportPreview | null,
  result: ImportCommitResponse | null,
  file: File | null
) {
  if (result) return 4;
  if (localPreview?.canSend) return 3;
  if (file) return 2;
  return 1;
}

function LocalPreviewTable({ preview }: { preview: LocalImportPreview }) {
  const totalRows = preview.rows.length;
  const netBalance = preview.incomeTotal - preview.expenseTotal;

  return (
    <div className="mt-6 w-full text-left space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total rows', value: totalRows, sub: preview.fileName, color: 'text-slate-300' },
          { label: 'Income rows', value: preview.incomeCount, sub: formatRs(preview.incomeTotal), color: 'text-emerald-400' },
          { label: 'Expense rows', value: preview.expenseCount, sub: formatRs(preview.expenseTotal), color: 'text-amber-400' },
          {
            label: 'Net balance',
            value: formatRs(netBalance),
            sub: 'Income − expenses',
            color: netBalance >= 0 ? 'text-teal-400' : 'text-rose-400',
          },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="text-lg font-semibold text-slate-100 mt-1">{card.value}</p>
            <p className={`text-xs mt-0.5 ${card.color}`}>{card.sub}</p>
          </div>
        ))}
      </div>

      {!preview.canSend && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {preview.structureErrors[0] || 'No importable rows were found in this file.'}
        </div>
      )}

      {preview.structureErrors.length > 0 && preview.canSend && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 space-y-1">
          <p className="font-medium">Some rows were skipped during preview:</p>
          {preview.structureErrors.map((message) => (
            <p key={message} className="text-xs text-amber-100/90">
              {message}
            </p>
          ))}
        </div>
      )}

      {preview.extraColumns.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {preview.extraColumns.map((column) => (
            <span
              key={column}
              className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-400"
            >
              {column}
            </span>
          ))}
        </div>
      )}

      {preview.rows.length > 0 && (
        <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950/80">
          <p className="px-4 py-3 text-sm font-semibold text-slate-200 border-b border-slate-800">
            File preview ({preview.rows.length} row{preview.rows.length === 1 ? '' : 's'})
          </p>
          <div className="overflow-auto max-h-[28rem] custom-scrollbar">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-slate-950 z-10">
                <tr className="border-b border-slate-800 text-slate-500">
                  <th className="px-4 py-2.5 text-left font-medium">Date</th>
                  <th className="px-4 py-2.5 text-left font-medium">Type</th>
                  <th className="px-4 py-2.5 text-left font-medium">Category</th>
                  <th className="px-4 py-2.5 text-left font-medium">Description / Source</th>
                  {preview.extraColumns.map((column) => (
                    <th key={column} className="px-4 py-2.5 text-left font-medium">
                      {column}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {preview.rows.map((row) => (
                  <tr key={`${row.sheet}-${row.row}-${row.kind}`} className="text-slate-300">
                    <td className="px-4 py-2.5 whitespace-nowrap">{row.date || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          row.kind === 'income'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {row.kind}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{row.type}</td>
                    <td className="px-4 py-2.5 max-w-[220px] truncate" title={row.detail ? `${row.label} · ${row.detail}` : row.label}>
                      {row.label}
                      {row.detail ? <span className="text-slate-500"> · {row.detail}</span> : null}
                    </td>
                    {preview.extraColumns.map((column) => (
                      <td key={`${row.sheet}-${row.row}-${column}`} className="px-4 py-2.5 max-w-[160px] truncate text-slate-400">
                        {row.extraFields[column] || '—'}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap">
                      {row.amount == null ? '—' : formatRs(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ImportPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<LocalImportPreview | null>(null);
  const [serverPreview, setServerPreview] = useState<ImportPreviewResponse | null>(null);
  const [result, setResult] = useState<ImportCommitResponse | null>(null);
  const [parsing, setParsing] = useState(false);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const step = activeStep(localPreview, result, file);

  const reset = () => {
    setFile(null);
    setLocalPreview(null);
    setServerPreview(null);
    setResult(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDownload = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Download failed.');
    }
  };

  const processFile = async (selected: File | null) => {
    setLocalPreview(null);
    setServerPreview(null);
    setResult(null);
    setError('');

    if (!selected) {
      setFile(null);
      return;
    }

    setFile(selected);
    setParsing(true);
    try {
      const parsed = await parseImportFile(selected);
      setLocalPreview(parsed);
      if (!parsed.structureValid) {
        setError(formatImportValidationError(parsed));
      }
    } catch {
      setError('Unable to read the file. Check that it is a valid Excel or CSV file.');
      setFile(null);
      setLocalPreview(null);
      if (inputRef.current) inputRef.current.value = '';
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) void processFile(dropped);
  };

  const handleSend = async () => {
    if (!localPreview?.canSend || sending) return;

    setSending(true);
    setError('');
    setServerPreview(null);

    try {
      const commitResult = await importService.commitRows(localPreview.payload);
      notifyLedgerChanged();
      setResult(commitResult);
    } catch (err) {
      if (err instanceof ApiError) {
        console.error('[import] commit failed', {
          status: err.status,
          message: err.message,
          payload: localPreview.payload,
        });
        setError(err.message || `Import failed with status ${err.status}.`);
      } else {
        console.error('[import] commit failed', err);
        setError('Import failed.');
      }
    } finally {
      setSending(false);
    }
  };

  const canSend = Boolean(file && localPreview?.canSend && !parsing);

  return (
      <div className="space-y-8 max-w-6xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 p-6 md:p-8">
          <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-teal-500/10 blur-3xl" />
          <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 typo-overline tracking-wider text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" /> Bulk data import
              </div>
              <h1 className="text-3xl md:text-4xl font-display font-semibold text-slate-100">
                Import from Excel or CSV
              </h1>
              <p className="text-slate-400 text-sm md:text-base leading-relaxed">
                Bring in income and expenses in one go. Preview your file locally, then send it to update dashboard,
                budgets, analytics, and reports.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {STEPS.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium border transition-colors ${
                    step >= item.id
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-800 bg-slate-950/60 text-slate-500'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                      step >= item.id ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {step > item.id ? '✓' : item.id}
                  </span>
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!result && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => void handleDownload(() => importService.downloadTemplate())}
              className="group text-left p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/30 hover:bg-slate-900/80 transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <Download className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
              </div>
              <p className="font-semibold text-slate-100">Excel workbook</p>
              <p className="text-xs text-slate-400 mt-1">Income + Expenses sheets with sample rows (.xlsx)</p>
            </button>

            <button
              type="button"
              onClick={() => void handleDownload(() => importService.downloadIncomeCsv())}
              className="group text-left p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-teal-500/30 hover:bg-slate-900/80 transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 group-hover:scale-105 transition-transform">
                  <Wallet className="w-5 h-5" />
                </div>
                <Download className="w-4 h-4 text-slate-500 group-hover:text-teal-400 transition-colors" />
              </div>
              <p className="font-semibold text-slate-100">Income CSV</p>
              <p className="text-xs text-slate-400 mt-1">Open in TextEdit or Google Sheets — upload separately</p>
            </button>

            <button
              type="button"
              onClick={() => void handleDownload(() => importService.downloadExpensesCsv())}
              className="group text-left p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/30 hover:bg-slate-900/80 transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform">
                  <Receipt className="w-5 h-5" />
                </div>
                <Download className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
              </div>
              <p className="font-semibold text-slate-100">Expenses CSV</p>
              <p className="text-xs text-slate-400 mt-1">Category, payment method, Need/Want columns included</p>
            </button>
          </div>
        )}

        {!result && (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`relative rounded-3xl border-2 border-dashed p-8 md:p-12 transition-all ${
              dragging
                ? 'border-emerald-400 bg-emerald-500/5 scale-[1.01]'
                : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              className="hidden"
              onChange={(event) => void processFile(event.target.files?.[0] || null)}
            />

            <div className="flex flex-col items-center text-center space-y-4">
              <div
                className={`p-4 rounded-2xl border ${dragging ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-slate-950 border-slate-800'}`}
              >
                {parsing ? (
                  <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                ) : (
                  <CloudUpload className={`w-10 h-10 ${dragging ? 'text-emerald-400' : 'text-slate-400'}`} />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  {parsing ? 'Reading your file…' : localPreview ? 'Preview ready' : 'Drop your file here'}
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  {localPreview
                    ? 'Review the summary and table below. Nothing is sent until you click Import rows.'
                    : 'or click below · .xlsx, .xls, .csv · max 5 MB'}
                </p>
              </div>
              {file && !parsing && (
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 border border-slate-800 px-4 py-2 text-sm text-slate-300">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  {file.name}
                  {localPreview ? (
                    <span className="text-xs text-slate-500">
                      · {localPreview.rows.length} row{localPreview.rows.length === 1 ? '' : 's'}
                    </span>
                  ) : null}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-3">
                {!file ? (
                  <button
                    type="button"
                    disabled={parsing || sending}
                    onClick={() => inputRef.current?.click()}
                    className="px-6 py-3 rounded-xl bg-ink-900 hover:bg-ink-800 disabled:opacity-50 text-white font-medium text-sm flex items-center gap-2 shadow-lg shadow-black/20"
                  >
                    <Upload className="w-4 h-4" />
                    Browse files
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={parsing || sending}
                      onClick={reset}
                      className="px-6 py-3 rounded-xl border border-slate-700 hover:bg-slate-950 disabled:opacity-50 text-slate-200 font-medium text-sm flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Choose another file
                    </button>
                    <button
                      type="button"
                      disabled={!canSend || sending}
                      onClick={() => void handleSend()}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm flex items-center gap-2 shadow-lg shadow-emerald-900/30"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Importing…
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" /> Import rows
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>

              {localPreview && !parsing && <LocalPreviewTable preview={localPreview} />}
            </div>
          </div>
        )}

        {serverPreview && !serverPreview.ready && !result && (
          <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 to-orange-500/5 p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold">
              <AlertTriangle className="w-4 h-4" />
              {serverPreview.errorCount} row{serverPreview.errorCount === 1 ? '' : 's'} need fixing before import
            </div>
            <div className="space-y-1.5 max-h-44 overflow-y-auto text-xs text-amber-100/90 custom-scrollbar">
              {serverPreview.errors.map((item) => (
                <p key={`${item.sheet}-${item.row}-${item.message}`} className="rounded-lg bg-slate-950/50 px-3 py-2">
                  <span className="font-mono text-amber-300">
                    {item.sheet} · row {item.row}
                  </span>
                  <span className="text-slate-300"> — {item.message}</span>
                </p>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-slate-900 to-emerald-950/30 p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-display font-semibold text-slate-100">Import complete</h2>
                <p className="text-sm text-slate-400 mt-1">{result.message}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Imported income</p>
                <p className="text-2xl font-semibold text-slate-100 mt-1">{result.imported.incomeCount}</p>
                <p className="text-sm text-emerald-400 mt-1">{formatRs(result.imported.incomeTotal)}</p>
              </div>
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Imported expenses</p>
                <p className="text-2xl font-semibold text-slate-100 mt-1">{result.imported.expenseCount}</p>
                <p className="text-sm text-amber-400 mt-1">{formatRs(result.imported.expenseTotal)}</p>
              </div>
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800">
                <p className="text-xs text-slate-400 uppercase tracking-wide">{result.currentMonth.label} now</p>
                <p className="text-sm text-slate-200 mt-2">Income {formatRs(result.currentMonth.income)}</p>
                <p className="text-sm text-slate-200">Expenses {formatRs(result.currentMonth.expense)}</p>
                <p className="text-sm text-teal-400 font-medium mt-1">
                  Savings {formatRs(result.currentMonth.savings)} ({result.currentMonth.savingsRate}%)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="px-5 py-2.5 rounded-xl bg-ink-900 hover:bg-ink-800 text-white text-sm font-medium flex items-center gap-2"
              >
                Open dashboard <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/analytics"
                className="px-5 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-950 text-slate-200 text-sm font-medium"
              >
                View analytics
              </Link>
              <button
                type="button"
                onClick={reset}
                className="px-5 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-950 text-slate-400 text-sm font-medium"
              >
                Import another file
              </button>
            </div>
          </div>
        )}

        {!result && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <p className="text-sm font-semibold text-slate-200 mb-2">How it works</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Drop or browse for a file — we parse it locally with SheetJS and show a preview immediately. Click{' '}
                <strong className="text-emerald-300">Import rows</strong> when you are ready to send the file to your
                ledger. No data leaves your browser until then.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400 space-y-2">
              <p className="text-sm font-semibold text-slate-200">Required columns</p>
              <p>
                <span className="text-emerald-400 font-medium">Income:</span> amount, source, date, incomeType
              </p>
              <p>
                <span className="text-amber-400 font-medium">Expenses:</span> amount, description, category, date,
                paymentMethod, transactionType
              </p>
            </div>
          </div>
        )}
      </div>
  );
}
