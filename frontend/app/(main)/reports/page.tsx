'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Download, FileText } from 'lucide-react';
import {
  reportService,
  ReportMonthOption,
  ReportPayload,
} from '../../../services/report.service';
import { ApiError } from '../../../lib/api';

function formatRs(amount: number) {
  return `Rs. ${Math.round(amount).toLocaleString('en-US')}`;
}

function healthClass(status: string | undefined) {
  if (status === 'Excellent' || status === 'Good') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (status === 'Moderate') return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
}

function monthOptionLabel(option: ReportMonthOption) {
  return `${option.label} ${option.key.slice(0, 4)}`;
}

export default function ReportsPage() {
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [availableMonths, setAvailableMonths] = useState<ReportMonthOption[]>([]);
  const [currentMonthKey, setCurrentMonthKey] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState<'pdf' | 'xls' | ''>('');
  const [rowExporting, setRowExporting] = useState('');

  const loadReport = async (month?: string) => {
    setError('');
    setLoading(true);
    try {
      const result = await reportService.get(month);
      setReport(result.report);
      setAvailableMonths(result.availableMonths);
      setCurrentMonthKey(result.currentMonthKey);
      setSelectedMonth(result.report.period.key);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load the statement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
  }, []);

  const handleMonthChange = (monthKey: string) => {
    setSelectedMonth(monthKey);
    void loadReport(monthKey);
  };

  const handleExport = async (kind: 'pdf' | 'xls', monthKey?: string) => {
    const month = monthKey || selectedMonth;
    if (!month) return;
    setError('');
    if (monthKey) {
      setRowExporting(`${monthKey}-${kind}`);
    } else {
      setExporting(kind);
    }
    try {
      if (kind === 'pdf') {
        await reportService.downloadPdf(month);
      } else {
        await reportService.downloadExcel(month);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to download the file.');
    } finally {
      setExporting('');
      setRowExporting('');
    }
  };

  const year = report?.period.key.slice(0, 4);
  const expenseTotal = report?.currentMonth.expense || 0;
  const isCurrentMonth = selectedMonth === currentMonthKey;

  return (
      <div className="space-y-8 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-slate-900 border border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-semibold border border-purple-500/20">
              <FileText className="w-3.5 h-3.5" /> Statement generator
            </div>
            <h1 className="text-2xl md:text-3xl font-display font-semibold text-slate-100 mt-1">
              Financial statements
            </h1>
            <p className="text-slate-400 text-xs md:text-sm">
              Current month by default. Filter any month, view transaction details, and download PDF or Excel.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800">
              <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                disabled={loading || availableMonths.length === 0}
                className="bg-transparent text-sm text-slate-200 focus:outline-none min-w-[160px]"
              >
                {availableMonths.map((option) => (
                  <option key={option.key} value={option.key} className="bg-slate-900">
                    {monthOptionLabel(option)}
                    {option.key === currentMonthKey ? ' (current)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!report || Boolean(exporting) || Boolean(rowExporting)}
                onClick={() => void handleExport('pdf')}
                className="px-4 py-2.5 rounded-md bg-ink-900 hover:bg-ink-800 text-white font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> {exporting === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}
              </button>
              <button
                type="button"
                disabled={!report || Boolean(exporting) || Boolean(rowExporting)}
                onClick={() => void handleExport('xls')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-2 border border-slate-700 transition-all disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> {exporting === 'xls' ? 'Preparing Excel…' : 'Export Excel'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
            <span>{error}</span>
            <button type="button" onClick={() => void loadReport(selectedMonth)} className="font-medium underline-offset-2 hover:underline">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Loading statement…</p>
        ) : !report ? (
          <p className="text-sm text-slate-400">No statement available yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-ink-100 bg-white text-ink-900 shadow-lift [&_h2]:text-white [&_h3]:text-ink-500">
            <div className="bg-ink-900 px-8 py-6 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="typo-overline text-emerald-400">SmartFin AI</p>
                  <h2 className="text-2xl font-display font-semibold mt-1 text-white">Monthly Financial Statement</h2>
                  <p className="text-sm text-ink-100 mt-2">Prepared for {report.preparedFor}</p>
                </div>
                <div className="text-right">
                  <p className="typo-overline text-ink-300">Period</p>
                  <p className="text-lg font-semibold text-white">{report.period.label} {year}</p>
                  {isCurrentMonth && (
                    <p className="text-xs text-emerald-400 mt-1 font-semibold">CURRENT MONTH</p>
                  )}
                  <p className="text-xs text-emerald-400 mt-2 font-semibold">CONFIDENTIAL</p>
                </div>
              </div>
            </div>
            <div className="h-1 bg-emerald-400" />

            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border border-ink-100 rounded-lg p-4 border-l-4 border-l-emerald-400">
                  <p className="typo-overline tracking-wider text-ink-400">Income</p>
                  <p className="text-xl font-semibold text-ink-900 mt-1">{formatRs(report.currentMonth.income)}</p>
                  <p className="text-xs text-ink-400 mt-1">{report.incomes.length} transaction(s)</p>
                </div>
                <div className="border border-ink-100 rounded-lg p-4 border-l-4 border-l-amber-500">
                  <p className="typo-overline tracking-wider text-ink-400">Expenses</p>
                  <p className="text-xl font-semibold text-ink-900 mt-1">{formatRs(report.currentMonth.expense)}</p>
                  <p className="text-xs text-ink-400 mt-1">{report.expenses.length} transaction(s)</p>
                </div>
                <div className="border border-ink-100 rounded-lg p-4 border-l-4 border-l-purple-400">
                  <p className="typo-overline tracking-wider text-ink-400">Net savings</p>
                  <p className="text-xl font-semibold text-ink-900 mt-1">
                    {formatRs(report.currentMonth.savings)}
                    <span className="text-sm font-medium text-ink-400 ml-2">({report.currentMonth.savingsRate}%)</span>
                  </p>
                </div>
              </div>

              <section>
                <h3 className="typo-overline text-ink-400 border-b border-ink-100 pb-2 mb-3">
                  Income details
                </h3>
                {report.incomes.length === 0 ? (
                  <p className="text-sm text-ink-400">No income recorded for this month.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-ink-900">
                      <thead>
                        <tr className="bg-ink-900 text-white">
                          <th className="text-left font-medium px-3 py-2">Date</th>
                          <th className="text-left font-medium px-3 py-2">Source</th>
                          <th className="text-left font-medium px-3 py-2">Type</th>
                          <th className="text-left font-medium px-3 py-2">Description</th>
                          <th className="text-right font-medium px-3 py-2">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.incomes.map((row) => (
                          <tr key={row.id} className="border-b border-ink-50">
                            <td className="px-3 py-2 text-ink-900">{row.date}</td>
                            <td className="px-3 py-2 text-ink-900">{row.source}</td>
                            <td className="px-3 py-2 text-ink-900">{row.incomeType}</td>
                            <td className="px-3 py-2 text-ink-400">{row.description || '—'}</td>
                            <td className="px-3 py-2 text-right font-medium text-ink-900">{formatRs(row.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section>
                <h3 className="typo-overline text-ink-400 border-b border-ink-100 pb-2 mb-3">
                  Expense details
                </h3>
                {report.expenses.length === 0 ? (
                  <p className="text-sm text-ink-400">No expenses recorded for this month.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-ink-900">
                      <thead>
                        <tr className="bg-ink-900 text-white">
                          <th className="text-left font-medium px-3 py-2">Date</th>
                          <th className="text-left font-medium px-3 py-2">Category</th>
                          <th className="text-left font-medium px-3 py-2">Description</th>
                          <th className="text-left font-medium px-3 py-2">Payment</th>
                          <th className="text-right font-medium px-3 py-2">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.expenses.map((row) => (
                          <tr key={row.id} className="border-b border-ink-50">
                            <td className="px-3 py-2 text-ink-900">{row.date}</td>
                            <td className="px-3 py-2 text-ink-900">{row.category}</td>
                            <td className="px-3 py-2 text-ink-900">{row.description}</td>
                            <td className="px-3 py-2 text-ink-400">{row.paymentMethod}</td>
                            <td className="px-3 py-2 text-right font-medium text-ink-900">{formatRs(row.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section>
                <h3 className="typo-overline text-ink-400 border-b border-ink-100 pb-2 mb-3">
                  Spending by category
                </h3>
                {report.currentMonth.byCategory.length === 0 ? (
                  <p className="text-sm text-ink-400">No expenses recorded this month.</p>
                ) : (
                  <table className="w-full text-sm text-ink-900">
                    <thead>
                      <tr className="bg-ink-900 text-white">
                        <th className="text-left font-medium px-3 py-2">Category</th>
                        <th className="text-right font-medium px-3 py-2">Amount</th>
                        <th className="text-right font-medium px-3 py-2">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.currentMonth.byCategory.map((row) => (
                        <tr key={row.category} className="border-b border-ink-50">
                          <td className="px-3 py-2 text-ink-900">{row.category}</td>
                          <td className="px-3 py-2 text-right font-medium text-ink-900">{formatRs(row.amount)}</td>
                          <td className="px-3 py-2 text-right text-ink-400">
                            {expenseTotal ? `${((row.amount / expenseTotal) * 100).toFixed(1)}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <section>
                <h3 className="typo-overline text-ink-400 border-b border-ink-100 pb-2 mb-3">
                  Budgets
                </h3>
                {report.budgets.length === 0 ? (
                  <p className="text-sm text-ink-400">No budgets set for this month.</p>
                ) : (
                  <table className="w-full text-sm text-ink-900">
                    <thead>
                      <tr className="bg-ink-900 text-white">
                        <th className="text-left font-medium px-3 py-2">Budget</th>
                        <th className="text-right font-medium px-3 py-2">Spent</th>
                        <th className="text-right font-medium px-3 py-2">Limit</th>
                        <th className="text-right font-medium px-3 py-2">Utilization</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.budgets.map((budget) => (
                        <tr key={budget.id} className="border-b border-ink-50">
                          <td className="px-3 py-2 text-ink-900">{budget.category || 'Overall'}</td>
                          <td className="px-3 py-2 text-right text-ink-900">{formatRs(budget.spent)}</td>
                          <td className="px-3 py-2 text-right text-ink-900">{formatRs(budget.amount)}</td>
                          <td className={`px-3 py-2 text-right font-medium ${budget.utilization > 100 ? 'text-rose-500' : 'text-ink-900'}`}>
                            {budget.utilization}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              {isCurrentMonth && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="border border-ink-100 rounded-lg p-4 bg-ink-50">
                    <p className="typo-overline tracking-wider text-ink-400">Next-month forecast</p>
                    {report.prediction ? (
                      <>
                        <p className="text-xl font-semibold text-purple-500 mt-1">{formatRs(report.prediction.predictedAmount)}</p>
                        <p className="text-xs text-ink-400 mt-1">
                          {report.prediction.predictionPeriod} · {report.prediction.modelUsed}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-ink-400 mt-2">No stored forecast. Train a model on Predictions first.</p>
                    )}
                  </div>
                  <div className="border border-ink-100 rounded-lg p-4 bg-ink-50">
                    <p className="typo-overline tracking-wider text-ink-400">Financial health</p>
                    {report.health ? (
                      <div className="mt-2 flex items-center gap-3">
                        <p className="text-xl font-semibold text-ink-900">{report.health.overallScore} / 100</p>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${healthClass(report.health.status)}`}>
                          {report.health.status}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-ink-400 mt-2">Health score is not available.</p>
                    )}
                  </div>
                </div>
              )}

              {report.goals.length > 0 && (
                <section>
                  <h3 className="typo-overline text-ink-400 border-b border-ink-100 pb-2 mb-3">
                    Savings goals
                  </h3>
                  <table className="w-full text-sm text-ink-900">
                    <thead>
                      <tr className="bg-ink-900 text-white">
                        <th className="text-left font-medium px-3 py-2">Goal</th>
                        <th className="text-left font-medium px-3 py-2">Status</th>
                        <th className="text-right font-medium px-3 py-2">Remaining</th>
                        <th className="text-right font-medium px-3 py-2">Required / month</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.goals.map((goal) => (
                        <tr key={goal.name} className="border-b border-ink-50">
                          <td className="px-3 py-2 text-ink-900">{goal.name}</td>
                          <td className="px-3 py-2 text-ink-900">{goal.status}</td>
                          <td className="px-3 py-2 text-right text-ink-900">{formatRs(goal.remaining)}</td>
                          <td className="px-3 py-2 text-right text-ink-900">{formatRs(goal.requiredMonthly)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              <section className="bg-ink-50 border border-ink-100 rounded-lg p-4">
                <h3 className="typo-overline text-ink-400 mb-2">
                  Executive summary
                </h3>
                <p className="text-sm leading-relaxed text-ink-700">{report.executiveSummary}</p>
              </section>
            </div>
          </div>
        )}

        {availableMonths.length > 0 && (
          <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">All month reports</h2>
              <p className="text-xs text-slate-400 mt-1">
                Browse every month with recorded activity. Select a row to view details or download directly.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <th className="pb-3 pr-4">Month</th>
                    <th className="pb-3 pr-4 text-right">Income</th>
                    <th className="pb-3 pr-4 text-right">Expenses</th>
                    <th className="pb-3 pr-4 text-right">Savings</th>
                    <th className="pb-3 text-right">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {availableMonths.map((option) => (
                    <tr
                      key={option.key}
                      className={`hover:bg-slate-800/40 transition-colors ${option.key === selectedMonth ? 'bg-slate-800/30' : ''}`}
                    >
                      <td className="py-3 pr-4">
                        <button
                          type="button"
                          onClick={() => handleMonthChange(option.key)}
                          className="text-left font-medium text-slate-100 hover:text-emerald-400"
                        >
                          {monthOptionLabel(option)}
                          {option.key === currentMonthKey && (
                            <span className="ml-2 text-xs text-emerald-400">current</span>
                          )}
                        </button>
                      </td>
                      <td className="py-3 pr-4 text-right text-slate-300">{formatRs(option.income)}</td>
                      <td className="py-3 pr-4 text-right text-slate-300">{formatRs(option.expense)}</td>
                      <td className={`py-3 pr-4 text-right font-medium ${option.savings >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatRs(option.savings)}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={Boolean(exporting) || Boolean(rowExporting)}
                            onClick={() => void handleExport('pdf', option.key)}
                            className="px-2.5 py-1 rounded-md text-xs border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                          >
                            {rowExporting === `${option.key}-pdf` ? 'PDF…' : 'PDF'}
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(exporting) || Boolean(rowExporting)}
                            onClick={() => void handleExport('xls', option.key)}
                            className="px-2.5 py-1 rounded-md text-xs border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                          >
                            {rowExporting === `${option.key}-xls` ? 'Excel…' : 'Excel'}
                          </button>
                        </div>
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
