'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Wallet,
} from 'lucide-react';
import { chartTheme, tooltipStyle } from '../../../lib/theme';
import { summaryService, SummaryResponse } from '../../../services/summary.service';
import { ApiError } from '../../../lib/api';
import {
  budgetStatusLabel,
  categoryWithShare,
  monthlyWithRates,
  trendLabel,
} from '../../../lib/analytics-utils';
import {
  getPeriodOverviewText,
  parseDashboardPeriod,
  type DashboardPeriodValue,
} from '../../../lib/dashboard-period';
import PeriodFilter from '../../../components/dashboard/PeriodFilter';
import {
  ErrorBanner,
  PageBadge,
  PageCard,
  PageHeader,
  PageShell,
  PageSkeleton,
} from '../../../components/layout/PageLayout';
import { currentMonthKey } from '../../../lib/ledger-events';

export default function AnalyticsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<DashboardPeriodValue>(currentMonthKey());
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSummary = async (period = selectedPeriod) => {
    setError('');
    setLoading(true);
    try {
      setSummary(await summaryService.get({ months: 12, ...parseDashboardPeriod(period) }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary(selectedPeriod);
  }, [selectedPeriod]);

  const period = summary?.currentMonth;
  const monthly = summary?.monthly ?? [];
  const totalExpense = period?.expense ?? 0;
  const categories = useMemo(
    () => categoryWithShare(period?.byCategory ?? [], totalExpense),
    [period?.byCategory, totalExpense]
  );
  const monthlyRows = useMemo(() => monthlyWithRates(monthly), [monthly]);
  const budgetVariance = summary?.budgetVariance ?? [];

  const incomeUp = (period?.incomeChangePercent ?? 0) >= 0;
  const expenseUp = (period?.expenseChangePercent ?? 0) >= 0;

  return (
    <PageShell>
      <PageHeader
        overline="Insights"
        title="Analytics"
        description={getPeriodOverviewText(period)}
        action={<PeriodFilter value={selectedPeriod} onChange={setSelectedPeriod} />}
      />

      {error ? <ErrorBanner message={error} onRetry={() => loadSummary(selectedPeriod)} /> : null}

      {loading ? (
        <PageSkeleton rows={6} />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PageCard
              title="Spend by category"
              subtitle={period ? `Top categories · ${period.label}` : 'Category breakdown'}
              badge={<PageBadge tone="neutral">CATEGORIES</PageBadge>}
            >
              {categories.length === 0 ? (
                <p className="text-sm text-slate-400 py-16 text-center">Add expenses to see category totals.</p>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categories} barCategoryGap="24%">
                      <CartesianGrid stroke={chartTheme.mutedBar} strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="category"
                        stroke={chartTheme.axis}
                        fontSize={chartTheme.tickFontSize}
                        tickLine={false}
                      />
                      <YAxis
                        stroke={chartTheme.axis}
                        fontSize={chartTheme.tickFontSize}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => (v >= 1000 ? `Rs.${v / 1000}k` : `Rs.${v}`)}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(val: number) => [`Rs. ${Number(val).toLocaleString()}`, 'Amount']}
                      />
                      <Bar dataKey="amount" fill={chartTheme.copper} radius={[6, 6, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </PageCard>

            <PageCard title="Monthly savings" subtitle="Net savings by month">
              {monthly.every((row) => row.income === 0 && row.expense === 0) ? (
                <p className="text-sm text-slate-400 py-16 text-center">Add transactions to see savings by month.</p>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyRows} barCategoryGap="24%">
                      <CartesianGrid stroke={chartTheme.mutedBar} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" stroke={chartTheme.axis} fontSize={chartTheme.tickFontSize} tickLine={false} />
                      <YAxis
                        stroke={chartTheme.axis}
                        fontSize={chartTheme.tickFontSize}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => (Math.abs(v) >= 1000 ? `Rs.${v / 1000}k` : `Rs.${v}`)}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(val: number, name: string) => {
                          if (name === 'Savings rate') return [`${val}%`, name];
                          return [`Rs. ${Number(val).toLocaleString()}`, name];
                        }}
                      />
                      <Bar
                        dataKey="savings"
                        name="Net savings"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={40}
                      >
                        {monthlyRows.map((row) => (
                          <Cell
                            key={row.monthKey}
                            fill={row.savings >= 0 ? chartTheme.sage : chartTheme.palette[6]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </PageCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PageCard
              title="Category breakdown"
              subtitle="Share of total spending"
              badge={<PageBadge tone="info">{categories.length} CATEGORIES</PageBadge>}
            >
              {categories.length === 0 ? (
                <p className="text-sm text-slate-400">No category data for this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-left">
                        <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Category</th>
                        <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Amount</th>
                        <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((item) => (
                        <tr key={item.category} className="border-b border-slate-800/80 last:border-0">
                          <td className="px-3 py-2.5 text-slate-100">{item.category}</td>
                          <td className="px-3 py-2.5 text-slate-300">Rs. {item.amount.toLocaleString()}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden max-w-[80px]">
                                <div className="h-full bg-ink-900 rounded-full" style={{ width: `${item.share}%` }} />
                              </div>
                              <span className="text-slate-400 text-xs">{item.share}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </PageCard>

            <PageCard
              title="Monthly ledger summary"
              subtitle="Income, expenses, and savings rate"
              badge={<PageBadge tone="neutral">{monthlyRows.length} MONTHS</PageBadge>}
            >
              {monthlyRows.length === 0 ? (
                <p className="text-sm text-slate-400">No monthly data yet.</p>
              ) : (
                <div className="overflow-x-auto max-h-72 overflow-y-auto custom-scrollbar">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead className="sticky top-0 bg-slate-900">
                      <tr className="border-b border-slate-800 text-left">
                        <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Month</th>
                        <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Income</th>
                        <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Expenses</th>
                        <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Savings</th>
                        <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyRows.map((row) => (
                        <tr key={row.monthKey} className="border-b border-slate-800/80 last:border-0">
                          <td className="px-3 py-2.5 text-slate-100 font-medium">{row.month}</td>
                          <td className="px-3 py-2.5 text-emerald-400">Rs. {row.income.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-amber-500">Rs. {row.expense.toLocaleString()}</td>
                          <td className={`px-3 py-2.5 ${row.savings >= 0 ? 'text-slate-200' : 'text-rose-400'}`}>
                            Rs. {row.savings.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-slate-400">{row.savingsRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </PageCard>
          </div>

          {budgetVariance.length > 0 && (
            <PageCard
              title="Budget variance"
              subtitle={`Budget tracking for ${period?.label ?? 'selected period'}`}
              badge={<PageBadge tone="warn">{budgetVariance.filter((b) => b.status === 'over').length} OVER</PageBadge>}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-left">
                      <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Category</th>
                      <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Budgeted</th>
                      <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Actual</th>
                      <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Variance</th>
                      <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetVariance.map((row) => (
                      <tr key={row.id} className="border-b border-slate-800/80 last:border-0">
                        <td className="px-3 py-2.5 text-slate-100">{row.category || 'Overall'}</td>
                        <td className="px-3 py-2.5 text-slate-300">Rs. {row.budgeted.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-slate-300">Rs. {row.actual.toLocaleString()}</td>
                        <td className={`px-3 py-2.5 ${row.variance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {row.variance > 0 ? '+' : ''}Rs. {row.variance.toLocaleString()} ({row.variancePercent}%)
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                              row.status === 'over'
                                ? 'text-rose-400 border-rose-500/30 bg-rose-500/10'
                                : row.status === 'under'
                                  ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                                  : 'text-slate-400 border-slate-800 bg-slate-950'
                            }`}
                          >
                            {budgetStatusLabel(row.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PageCard>
          )}

          {period && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
                <Wallet className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400">Income trend</p>
                  <p className="text-sm text-slate-100 mt-1 flex items-center gap-1">
                    {incomeUp ? (
                      <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-rose-400" />
                    )}
                    {trendLabel(period.incomeChangePercent)}
                  </p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
                <BarChart3 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400">Expense trend</p>
                  <p className="text-sm text-slate-100 mt-1 flex items-center gap-1">
                    {expenseUp ? (
                      <ArrowUpRight className="w-4 h-4 text-amber-400" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-emerald-400" />
                    )}
                    {trendLabel(period.expenseChangePercent)}
                  </p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
                <Activity className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400">Top category</p>
                  <p className="text-sm text-slate-100 mt-1">
                    {categories[0]
                      ? `${categories[0].category} · ${categories[0].share}% (Rs. ${categories[0].amount.toLocaleString()})`
                      : 'No spending recorded'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
