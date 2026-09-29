'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppLayout from '../../components/layout/AppLayout';
import { recurringService, RecurringTemplate } from '../../services/recurring.service';
import { fetchSubscriptions, SubscriptionsSummary } from '../../services/subscriptions.service';
import { ApiError } from '../../lib/api';
import { RefreshCw, Wallet, Receipt, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';

const currentMonth = () => new Date().toISOString().slice(0, 7);

export default function RecurringPage() {
  const [income, setIncome] = useState<RecurringTemplate[]>([]);
  const [expense, setExpense] = useState<RecurringTemplate[]>([]);
  const [subSummary, setSubSummary] = useState<SubscriptionsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [processResult, setProcessResult] = useState<string | null>(null);

  const loadData = async () => {
    setError('');
    setLoading(true);
    try {
      const [recRes, subRes] = await Promise.all([
        recurringService.list().catch(() => ({ income: [], expense: [] })),
        fetchSubscriptions().catch(() => ({
          data: {
            subscriptions: [],
            totalMonthlyCommitments: 0,
            totalAnnualCommitments: 0,
            activeCount: 0,
            priceIncreaseAlerts: [],
          },
        })),
      ]);
      setIncome(recRes.income);
      setExpense(recRes.expense);
      setSubSummary(subRes.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load subscriptions and recurring items.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleProcess = async () => {
    setProcessing(true);
    setError('');
    setProcessResult(null);
    try {
      const res = await recurringService.process(currentMonth());
      const { created, skipped } = res.result;
      const total = created.income + created.expense;
      if (total === 0) {
        setProcessResult(
          `No new entries needed for ${res.result.month}. ${skipped.income + skipped.expense} already posted.`
        );
      } else {
        setProcessResult(`Created ${created.income} income and ${created.expense} expense entries for ${res.result.month}.`);
      }
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to process recurring entries.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-slate-900 border border-slate-800">
          <div>
            <p className="typo-overline text-slate-400">Accounts</p>
            <h1 className="text-2xl md:text-3xl font-display font-semibold text-slate-100 mt-1">
              Bills &amp; Subscriptions
            </h1>
            <p className="text-slate-400 text-xs md:text-sm mt-1">
              Automated subscription intelligence · Price change alerts · Monthly auto-posting
            </p>
          </div>
          <button
            type="button"
            onClick={handleProcess}
            disabled={processing}
            className="px-5 py-2.5 rounded-md bg-ink-900 hover:bg-ink-800 text-white font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`} />
            {processing ? 'Processing…' : 'Process This Month'}
          </button>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void loadData()}
              className="shrink-0 font-medium underline-offset-2 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {processResult && (
          <div className="flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{processResult}</span>
          </div>
        )}

        {subSummary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <span className="text-xs font-medium text-slate-400">Monthly commitments</span>
              <h3 className="text-2xl font-display font-semibold text-slate-100">
                Rs. {subSummary.totalMonthlyCommitments.toLocaleString()} / mo
              </h3>
              <p className="text-xs text-slate-500">
                {subSummary.activeCount} active subscriptions &amp; recurring bills
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <span className="text-xs font-medium text-slate-400">Annual commitments</span>
              <h3 className="text-2xl font-display font-semibold text-slate-100">
                Rs. {subSummary.totalAnnualCommitments.toLocaleString()} / yr
              </h3>
              <p className="text-xs text-slate-500">Projected 12-month recurring expenditure</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <span className="text-xs font-medium text-slate-400">Price alerts</span>
              <h3 className="text-2xl font-display font-semibold text-slate-100">
                {subSummary.priceIncreaseAlerts.length} alerts
              </h3>
              <p className="text-xs text-slate-500">Subscription price changes detected</p>
            </div>
          </div>
        )}

        {subSummary?.priceIncreaseAlerts && subSummary.priceIncreaseAlerts.length > 0 && (
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-sm space-y-2">
            <div className="flex items-center gap-2 font-medium text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>Subscription price increase detected</span>
            </div>
            <ul className="list-disc list-inside text-xs space-y-1 text-amber-400/90">
              {subSummary.priceIncreaseAlerts.map((alert, idx) => (
                <li key={idx}>{alert}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Link
            href="/income"
            className="px-5 py-2.5 rounded-md bg-ink-900 hover:bg-ink-800 text-white text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add recurring income
          </Link>
          <Link
            href="/expenses"
            className="px-5 py-2.5 rounded-md border border-slate-800 hover:bg-slate-950 text-slate-100 text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add recurring expense
          </Link>
        </div>

        {loading ? (
          <div className="h-40 bg-slate-900 animate-pulse rounded-xl border border-slate-800" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="font-semibold text-lg text-slate-100 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-400" /> Recurring income ({income.length})
              </h3>
              {income.length === 0 ? (
                <p className="text-xs text-slate-400 py-4">
                  No recurring income yet. Add salary or other regular earnings with the recurring flag.
                </p>
              ) : (
                <div className="space-y-2">
                  {income.map((item) => (
                    <div
                      key={item.fingerprint}
                      className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-medium text-slate-100">{item.label}</p>
                        <p className="text-slate-400 mt-0.5">
                          {item.incomeType} · Last: {item.lastDate}
                        </p>
                      </div>
                      <span className="font-semibold text-emerald-400">Rs. {item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="font-semibold text-lg text-slate-100 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-400" /> Recurring expenses ({expense.length})
              </h3>
              {expense.length === 0 ? (
                <p className="text-xs text-slate-400 py-4">
                  No recurring expenses yet. Mark bills and subscriptions as recurring when adding them.
                </p>
              ) : (
                <div className="space-y-2">
                  {expense.map((item) => (
                    <div
                      key={item.fingerprint}
                      className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-medium text-slate-100">{item.label}</p>
                        <p className="text-slate-400 mt-0.5">
                          {item.category} · Last: {item.lastDate}
                        </p>
                      </div>
                      <span className="font-semibold text-amber-400">Rs. {item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4 lg:col-span-2">
              <h3 className="font-semibold text-lg text-slate-100 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" /> Auto-identified subscriptions (
                {subSummary?.subscriptions.length || 0})
              </h3>
              {subSummary?.subscriptions.length === 0 ? (
                <p className="text-xs text-slate-400 py-4">No recurring payment subscriptions detected yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {subSummary?.subscriptions.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-100">{sub.merchant}</p>
                          {sub.status === 'INCREASED' && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-semibold border border-amber-500/20">
                              Price increased
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 mt-0.5">
                          {sub.category} · Next expected: {sub.nextExpectedDate}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-100">
                          Rs. {sub.monthlyEquivalent.toLocaleString()}/mo
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Rs. {sub.annualEquivalent.toLocaleString()}/yr
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
