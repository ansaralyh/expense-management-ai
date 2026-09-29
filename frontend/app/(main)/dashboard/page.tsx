'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Wallet,
  CreditCard,
  PiggyBank,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  HeartPulse,
  Plus,
  ShieldAlert,
  ChevronRight,
  Lightbulb,
  AlertTriangle,
  Info,
  Sparkles,
  BrainCircuit,
} from 'lucide-react';
import { fetchAIInsights, AIInsightItem } from '../../../services/insights.service';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import Link from 'next/link';
import { chartTheme, tooltipStyle } from '../../../lib/theme';
import { useAuth } from '../../../context/AuthContext';
import { summaryService, SummaryResponse } from '../../../services/summary.service';
import { scoreService } from '../../../services/score.service';
import { predictionService } from '../../../services/prediction.service';
import { anomalyService } from '../../../services/anomaly.service';
import { ApiError } from '../../../lib/api';
import { AIInsight, Anomaly, FinancialHealthScore, Prediction } from '../../../types';
import { recommendationsService } from '../../../services/recommendations.service';
import { LEDGER_CHANGED_EVENT } from '../../../lib/ledger-events';
import {
  getChartSubtitle,
  getDeficitBannerTitle,
  getIncomeSubtext,
  getPeriodCardTitles,
  getPeriodOverviewText,
  parseDashboardPeriod,
  shouldShowForecastOnChart,
  type DashboardPeriodValue,
} from '../../../lib/dashboard-period';
import PeriodFilter from '../../../components/dashboard/PeriodFilter';

export default function DashboardPage() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<DashboardPeriodValue>('all');
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [score, setScore] = useState<FinancialHealthScore | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [recommendations, setRecommendations] = useState<AIInsight[]>([]);
  const [aiInsights, setAiInsights] = useState<AIInsightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [trainingForecast, setTrainingForecast] = useState(false);
  const [error, setError] = useState('');

  const loadSidecars = async () => {
    const [scoreResult, predictionResult, anomalyResult, recResult, insightResult] = await Promise.allSettled([
      scoreService.get(),
      predictionService.get(),
      anomalyService.list(),
      recommendationsService.list(),
      fetchAIInsights(),
    ]);
    setScore(scoreResult.status === 'fulfilled' ? scoreResult.value.score : null);
    setPrediction(predictionResult.status === 'fulfilled' ? predictionResult.value.prediction : null);
    setAnomalies(anomalyResult.status === 'fulfilled' ? anomalyResult.value.anomalies : []);
    setRecommendations(recResult.status === 'fulfilled' ? recResult.value.recommendations : []);
    setAiInsights(insightResult.status === 'fulfilled' ? insightResult.value.insights : []);
  };

  const loadSummary = async (period = selectedPeriod) => {
    setError('');
    setLoading(true);
    try {
      setSummary(await summaryService.get({ months: 6, ...parseDashboardPeriod(period) }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load dashboard totals.');
    } finally {
      setLoading(false);
    }
  };

  const reloadDashboard = useCallback(() => {
    loadSummary(selectedPeriod);
    loadSidecars();
  }, [selectedPeriod]);

  useEffect(() => {
    if (pathname !== '/dashboard') return;
    loadSidecars();
  }, [pathname]);

  useEffect(() => {
    if (pathname !== '/dashboard') return;
    loadSummary(selectedPeriod);
  }, [selectedPeriod, pathname]);

  useEffect(() => {
    const refresh = () => reloadDashboard();
    window.addEventListener(LEDGER_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(LEDGER_CHANGED_EVENT, refresh);
  }, [reloadDashboard]);

  const month = summary?.currentMonth;
  const cardTitles = getPeriodCardTitles(month);
  const periodOverview = getPeriodOverviewText(month);
  const isSingleMonthView = Boolean(month && !month.range);
  const totalIncome = month?.income || 0;
  const totalExpense = month?.expense || 0;
  const totalSavings = month?.savings || 0;
  const savingsRate = month?.savingsRate ?? 0;
  const isDeficit = totalSavings < 0;
  const deficitAmount = Math.abs(totalSavings);
  const healthIsAtRisk = isDeficit || score?.status === 'At Risk';
  const displayHealthStatus = isDeficit ? 'At Risk' : score?.status || 'Not scored yet';
  const deficitPeriodLabel = month?.label || 'this period';
  const healthTooltip = isDeficit
    ? `Deficit detected: Net savings is negative (Rs. ${deficitAmount.toLocaleString()}). Expenses exceed income for ${deficitPeriodLabel.toLowerCase()}, which lowers your health score.`
    : score?.status === 'At Risk'
      ? score.explanations.find(
          (item) =>
            item.toLowerCase().includes('savings') ||
            item.toLowerCase().includes('spending exceeds') ||
            item.toLowerCase().includes('income')
        ) || 'Your financial health score is in the at-risk range. Review spending and budgets.'
      : '';
  const needsTotal = month?.needsTotal || 0;
  const wantsTotal = month?.wantsTotal || 0;
  const needShare = totalExpense === 0 ? 0 : (needsTotal / totalExpense) * 100;
  const wantShare = totalExpense === 0 ? 0 : (wantsTotal / totalExpense) * 100;
  const pieData = [
    { name: 'Needs', value: needsTotal, color: chartTheme.sage },
    { name: 'Wants', value: wantsTotal, color: chartTheme.copper },
  ].filter((item) => item.value > 0);
  const topCategories = month?.byCategory.slice(0, 3) || [];
  const chartData = summary?.monthly || [];
  const showForecastOnChart = shouldShowForecastOnChart(selectedPeriod);
  const chartRows = useMemo(() => {
    const rows = chartData.map((row) => ({
      ...row,
      forecastExpense: undefined as number | undefined,
    }));
    if (prediction && showForecastOnChart) {
      const shortMonth = prediction.predictionPeriod.replace(/\s+\d{4}$/, '').trim() || 'Next';
      rows.push({
        month: `${shortMonth} (est.)`,
        monthKey: '',
        income: 0,
        expense: 0,
        savings: 0,
        forecastExpense: prediction.predictedAmount,
      });
    }
    return rows;
  }, [chartData, prediction, showForecastOnChart]);
  const incomeUp = (month?.incomeChangePercent || 0) >= 0;
  const incomeSubtext = getIncomeSubtext(month, month?.incomeChangePercent || 0, incomeUp);
  const chartSubtitle = getChartSubtitle(chartData);
  const deficitBannerTitle = getDeficitBannerTitle(month);

  const handleTrainForecast = async () => {
    setTrainingForecast(true);
    setError('');
    try {
      const res = await predictionService.train();
      setPrediction(res.prediction);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to train forecast. Is the ML service running on port 8000?');
    } finally {
      setTrainingForecast(false);
    }
  };

  return (
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-slate-900 border border-slate-800">
          <div className="space-y-1">
            <p className="typo-overline text-slate-400">Overview</p>
            <h1 className="text-2xl md:text-3xl font-display font-semibold text-slate-100">
              Welcome, {user?.name || 'there'}
            </h1>
            <p className="text-slate-400 text-sm">{periodOverview}</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 whitespace-nowrap">Period</span>
              <PeriodFilter value={selectedPeriod} onChange={setSelectedPeriod} />
            </div>
            <Link
              href="/income"
              className="px-4 py-2.5 rounded-md bg-ink-900 hover:bg-ink-800 text-white font-medium text-sm flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add income
            </Link>
            <Link
              href="/expenses"
              className="px-4 py-2.5 rounded-md border border-slate-800 hover:bg-slate-950 text-slate-100 font-medium text-sm flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add expense
            </Link>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
            <span>{error}</span>
            <button type="button" onClick={reloadDashboard} className="font-medium underline-offset-2 hover:underline">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Loading dashboard…</p>
        ) : (
          <>
            {isDeficit && (
              <div className="rounded-xl border-2 border-rose-500 bg-rose-950 px-4 py-4 md:px-5 md:py-5 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-white border border-rose-500 shrink-0">
                      <AlertTriangle className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-rose-500">{deficitBannerTitle}</p>
                      <p className="text-sm text-ink-800 mt-1">
                        Your expenses for {deficitPeriodLabel.toLowerCase()} exceed your income by{' '}
                        <span className="font-bold text-rose-500">Rs. {deficitAmount.toLocaleString()}</span>.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 md:shrink-0">
                    <Link
                      href="/expenses"
                      className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-sm font-semibold transition-colors shadow-sm"
                    >
                      Review Expenses
                    </Link>
                    <Link
                      href="/budgets"
                      className="px-4 py-2 rounded-lg border-2 border-ink-900 bg-white hover:bg-ink-50 text-ink-900 text-sm font-semibold transition-colors"
                    >
                      Adjust Budget
                    </Link>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">{cardTitles.income}</span>
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                    <Wallet className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-display font-semibold text-slate-100">
                    Rs. {totalIncome.toLocaleString()}
                  </h3>
                  <p
                    className={`text-xs flex items-center gap-1 font-medium mt-1 ${
                      month?.range === 'all' || incomeSubtext?.includes('Recorded')
                        ? 'text-slate-400'
                        : incomeUp
                          ? 'text-emerald-500'
                          : 'text-rose-500'
                    }`}
                  >
                    {month?.range !== 'all' && !incomeSubtext?.includes('Recorded') ? (
                      incomeUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />
                    ) : null}
                    {incomeSubtext}
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">{cardTitles.expense}</span>
                  <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500 border border-amber-500/20">
                    <CreditCard className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-display font-semibold text-slate-100">
                    Rs. {totalExpense.toLocaleString()}
                  </h3>
                  <p className="text-xs text-amber-500 font-medium mt-1">
                    {month?.range === 'all' && month.monthCount
                      ? `Across ${month.monthCount} month${month.monthCount === 1 ? '' : 's'} · `
                      : ''}
                    Need vs Want: {needShare.toFixed(0)}% / {wantShare.toFixed(0)}%
                  </p>
                </div>
              </div>

              <div
                className={`p-5 rounded-2xl border-2 space-y-3 ${
                  isDeficit ? 'border-rose-500 bg-rose-950' : 'border-slate-800 bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">{cardTitles.savings}</span>
                  <div
                    className={`p-2.5 rounded-xl border ${
                      isDeficit
                        ? 'bg-white text-rose-500 border-rose-500'
                        : 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                    }`}
                  >
                    <PiggyBank className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      className={`text-2xl font-display font-semibold ${
                        isDeficit ? 'text-rose-500' : 'text-slate-100'
                      }`}
                    >
                      Rs. {totalSavings.toLocaleString()}
                    </h3>
                    {isDeficit && (
                      <span className="inline-flex items-center rounded-full bg-rose-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Deficit
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-xs font-medium mt-1 ${
                      isDeficit ? 'text-ink-800' : 'text-teal-400'
                    }`}
                  >
                    {isDeficit ? (
                      <>
                        Expenses exceed income by{' '}
                        <strong className="text-rose-500">Rs. {deficitAmount.toLocaleString()}</strong>
                        {totalIncome > 0 ? (
                          <>
                            {' '}
                            · Savings rate: <strong className="text-rose-500">{savingsRate}%</strong>
                          </>
                        ) : null}
                      </>
                    ) : month?.range === 'all' ? (
                      <>
                        Lifetime savings rate: <strong>{savingsRate}%</strong>
                        {month.monthCount ? (
                          <>
                            {' '}
                            · {month.monthCount} month{month.monthCount === 1 ? '' : 's'} tracked
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>
                        Savings rate: <strong>{savingsRate}%</strong>
                        {isSingleMonthView ? ' (target ≥ 20%)' : ''}
                      </>
                    )}
                  </p>
                </div>
              </div>

              <Link
                href="/financial-health"
                className={`p-5 rounded-2xl bg-slate-900 border-2 space-y-3 hover:border-slate-700 transition-colors ${
                  healthIsAtRisk ? 'border-rose-500 bg-rose-950' : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">Financial health</span>
                  <div
                    className={`p-2.5 rounded-xl border ${
                      healthIsAtRisk
                        ? 'bg-white text-rose-500 border-rose-500'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}
                  >
                    <HeartPulse className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl font-display font-semibold text-slate-100">{score?.overallScore ?? '—'}</h3>
                    <span className="text-xs text-slate-400">/ 100</span>
                  </div>
                  <div className="group relative mt-1 inline-flex items-center gap-1.5">
                    <p
                      className={`text-xs font-semibold ${
                        healthIsAtRisk ? 'text-rose-500' : 'text-slate-400'
                      }`}
                    >
                      {displayHealthStatus}
                    </p>
                    {healthTooltip && (
                      <>
                        <Info className="w-3.5 h-3.5 text-rose-500 group-hover:text-rose-400 transition-colors" />
                        <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 rounded-lg border border-ink-800 bg-ink-900 px-3 py-2 text-[11px] leading-relaxed text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                          {healthTooltip}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        healthIsAtRisk ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(Math.max(score?.overallScore || 0, 0), 100)}%` }}
                    />
                  </div>
                </div>
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" /> Income and expenses
                  </h3>
                  <p className="text-xs text-slate-400">{chartSubtitle}</p>
                </div>
                <div className="h-72 w-full pt-4">
                  {chartData.every((row) => row.income === 0 && row.expense === 0) ? (
                    <p className="text-sm text-slate-400 pt-16 text-center">
                      Add income or expenses to see the cashflow chart.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartRows}>
                        <defs>
                          <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={chartTheme.sage} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={chartTheme.sage} stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={chartTheme.copper} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={chartTheme.copper} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="month" stroke={chartTheme.axis} fontSize={chartTheme.tickFontSize} tickLine={false} />
                        <YAxis
                          stroke={chartTheme.axis}
                          fontSize={chartTheme.tickFontSize}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => (v >= 1000 ? `Rs.${v / 1000}k` : `Rs.${v}`)}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value: number) => [`Rs. ${Number(value).toLocaleString()}`, '']}
                        />
                        <Area
                          type="monotone"
                          dataKey="income"
                          stroke={chartTheme.sage}
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#incomeGrad)"
                          name="Income"
                        />
                        <Area
                          type="monotone"
                          dataKey="expense"
                          stroke={chartTheme.copper}
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#expenseGrad)"
                          name="Expenses"
                        />
                        {prediction && showForecastOnChart && (
                          <Line
                            type="monotone"
                            dataKey="forecastExpense"
                            stroke="#10B981"
                            strokeWidth={3}
                            strokeDasharray="6 4"
                            dot={{ r: 4, fill: '#10B981' }}
                            name="Forecast expense"
                            connectNulls={false}
                          />
                        )}
                        <Legend wrapperStyle={{ fontSize: `${chartTheme.legendFontSize}px` }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <span className="typo-overline text-slate-400">Forecast</span>
                  <div>
                    <p className="text-xs text-slate-400">
                      {prediction ? prediction.predictionPeriod : 'Next-month prediction'}
                    </p>
                    <h2 className="text-xl font-display font-semibold text-slate-100 mt-1">
                      {prediction ? `Rs. ${prediction.predictedAmount.toLocaleString()}` : 'Not trained yet'}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      {prediction
                        ? `${prediction.modelUsed} · ${prediction.changePercentage >= 0 ? '+' : ''}${prediction.changePercentage}% vs last month`
                        : 'Train a model on /predictions after you have at least 3 months of expenses.'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {!prediction && (
                    <button
                      type="button"
                      onClick={() => void handleTrainForecast()}
                      disabled={trainingForecast}
                      className="w-full py-2.5 rounded-md bg-ink-900 hover:bg-ink-800 text-white font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <BrainCircuit className={`w-4 h-4 ${trainingForecast ? 'animate-pulse' : ''}`} />
                      {trainingForecast ? 'Training…' : 'Train forecast'}
                    </button>
                  )}
                  <Link
                    href="/predictions"
                    className="w-full py-2.5 rounded-md border border-slate-800 hover:bg-slate-950 text-slate-100 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    {prediction ? 'Open predictions' : 'Predictions & models'} <ChevronRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/forecast-lab"
                    className="w-full py-2.5 rounded-md border border-slate-800 hover:bg-slate-950 text-slate-400 font-medium text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    Six-month range (Forecast Lab)
                  </Link>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-400" /> Anomaly alerts
                  </h3>
                  <Link href="/anomalies" className="text-xs text-emerald-500 hover:underline">
                    View anomalies
                  </Link>
                </div>
                {anomalies.filter((item) => item.status === 'UNRESOLVED').length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No unresolved unusual expenses. Scan on the anomalies page after you have at least 8 expense entries.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {anomalies
                      .filter((item) => item.status === 'UNRESOLVED')
                      .slice(0, 3)
                      .map((item) => (
                        <p key={item.id} className="text-sm text-slate-300">
                          {item.expenseDescription} · Rs. {item.amount.toLocaleString()} ({item.severity})
                        </p>
                      ))}
                  </div>
                )}
              </div>

              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                    <PiggyBank className="w-5 h-5 text-teal-400" /> Need vs Want
                  </h3>
                  <Link href="/analytics" className="text-xs text-emerald-500 hover:underline">
                    Open analytics
                  </Link>
                </div>

                {totalExpense === 0 ? (
                  <p className="text-sm text-slate-400">Add an expense to see Need vs Want and top categories.</p>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
                    <div className="w-40 h-40 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value">
                            {pieData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xs text-slate-500">Spent</span>
                        <span className="text-xs font-bold text-slate-200">Rs. {totalExpense.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex-1 space-y-3 w-full">
                      {topCategories.length === 0 ? (
                        <p className="text-sm text-slate-400">
                          No category totals for {isSingleMonthView ? 'this month' : 'this period'}.
                        </p>
                      ) : (
                        topCategories.map((item) => {
                          const share = Math.round((item.amount / totalExpense) * 100);
                          return (
                            <div key={item.category} className="space-y-1.5 text-xs">
                              <div className="flex justify-between font-medium">
                                <span className="text-slate-300">{item.category}</span>
                                <span className="text-slate-100">
                                  {share}% (Rs. {item.amount.toLocaleString()})
                                </span>
                              </div>
                              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-ink-900" style={{ width: `${Math.min(share, 100)}%` }} />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-4 mt-2 border-t border-slate-800 space-y-4">
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-400" /> Smart recommendations
                    </h4>
                    {recommendations.length === 0 && aiInsights.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        Add more transactions to unlock personalized recommendations.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {recommendations.slice(0, 2).map((item) => (
                          <div
                            key={item.id}
                            className={`p-3 rounded-lg border text-xs ${
                              item.type === 'warning'
                                ? 'bg-amber-500/5 border-amber-500/20'
                                : item.type === 'positive'
                                  ? 'bg-emerald-500/5 border-emerald-500/20'
                                  : 'bg-slate-950/60 border-slate-800'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {item.type === 'warning' ? (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                              ) : (
                                <Info className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                              )}
                              <div>
                                <p className="font-semibold text-slate-100">{item.title}</p>
                                <p className="text-slate-400 mt-0.5 leading-relaxed line-clamp-2">{item.description}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {recommendations.length === 0 &&
                          aiInsights.slice(0, 2).map((item) => (
                            <div
                              key={item.id}
                              className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 text-xs space-y-1"
                            >
                              <p className="font-semibold text-slate-100 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                                {item.title}
                              </p>
                              <p className="text-slate-400 leading-relaxed line-clamp-2">{item.description}</p>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <Link
                    href="/assistant"
                    className="w-full py-2.5 rounded-md border border-slate-800 hover:bg-slate-950 text-slate-100 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    View full analysis
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
  );
}
