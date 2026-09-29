'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  BrainCircuit,
  Lightbulb,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  EmptyState,
  ErrorBanner,
  MetricCard,
  PageBadge,
  PageCard,
  PageHeader,
  PageShell,
  PageSkeleton,
  PrimaryButton,
} from '../../../components/layout/PageLayout';
import { advancedService, BehaviorResult } from '../../../services/advanced.service';
import { ApiError } from '../../../lib/api';
import { chartTheme, tooltipStyle } from '../../../lib/theme';
import {
  clusterColor,
  computeBehaviorScore,
  formatBehaviorMonth,
  scoreLabel,
  scoreTone,
  tableRecommendation,
  topShifts,
} from '../../../lib/behavior-utils';

export default function BehaviorPage() {
  const [result, setResult] = useState<BehaviorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setError('');
    setLoading(true);
    try {
      setResult(await advancedService.behavior());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to build a spending profile.');
    } finally {
      setLoading(false);
    }
  };

  const behaviorScore = result ? computeBehaviorScore(result) : 0;
  const shifts = result ? topShifts(result) : [];

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.months.map((row) => ({
      label: formatBehaviorMonth(row.month),
      total: row.total,
      wantPct: Math.round(row.wantShare * 100),
      cluster: row.cluster,
      fill: clusterColor(row.cluster),
    }));
  }, [result]);

  const tableRows = useMemo(() => {
    if (!result) return [];
    return result.months.map((row, index) => {
      const prev = index > 0 ? result.months[index - 1] : null;
      const wantDelta = prev ? row.wantShare - prev.wantShare : 0;
      const totalDelta = prev && prev.total > 0 ? ((row.total - prev.total) / prev.total) * 100 : 0;
      return {
        ...row,
        label: formatBehaviorMonth(row.month),
        wantDelta,
        totalDelta,
        recommendation: tableRecommendation(row, prev, result.topCategory),
      };
    });
  }, [result]);

  return (
    <PageShell>
      <PageHeader
        overline="Intelligence"
        title="Spending behavior"
        description="Clusters your months by category mix and suggests one change for the latest pattern. Requires at least 3 months of expenses and the ML service on port 8000."
        action={
          <PrimaryButton onClick={() => void run()} loading={loading} loadingLabel="Analyzing…">
            Analyze
          </PrimaryButton>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={() => void run()} /> : null}

      {loading ? (
        <PageSkeleton rows={5} />
      ) : !result ? (
        <EmptyState
          icon={<BrainCircuit className="w-10 h-10" />}
          title="No behavior profile yet"
          description="Add expenses across at least 3 different months, then run Analyze to see cluster trends, category shifts, and AI suggestions."
          action={
            <PrimaryButton onClick={() => void run()} loading={loading}>
              Run first analysis
            </PrimaryButton>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <MetricCard
              label="Detected profile"
              value={result.profile}
              hint={result.model}
              badge="ACTIVE"
              badgeTone="best"
            />
            <MetricCard
              label="Lead category"
              value={result.topCategory}
              hint={`Cluster ${result.cluster ?? result.months[result.months.length - 1]?.cluster ?? 0} · ${result.clusterCount ?? '—'} groups`}
              badge="TOP"
              badgeTone="neutral"
            />
            <MetricCard
              label="Want share (latest cluster)"
              value={`${Math.round(result.wantShare * 100)}%`}
              hint={
                result.silhouette != null
                  ? `Silhouette score ${result.silhouette} — higher means clearer clusters`
                  : 'Silhouette unavailable for this sample size'
              }
              badge={result.wantShare >= 0.35 ? 'ELEVATED' : 'NORMAL'}
              badgeTone={result.wantShare >= 0.35 ? 'warn' : 'best'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <PageCard
              className="lg:col-span-2"
              title="Monthly cluster trends"
              subtitle="Bar height = total spend · Line = want share % · Color = K-means cluster"
              badge={<PageBadge tone="info">ESTIMATED</PageBadge>}
            >
              <div className="h-80 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} barCategoryGap="22%">
                    <CartesianGrid stroke={chartTheme.mutedBar} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke={chartTheme.axis}
                      fontSize={chartTheme.tickFontSize}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke={chartTheme.axis}
                      fontSize={chartTheme.tickFontSize}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `Rs.${v / 1000}k` : `Rs.${v}`)}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke={chartTheme.axis}
                      fontSize={chartTheme.tickFontSize}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number, name: string) => {
                        if (name === 'Want share') return [`${value}%`, name];
                        return [`Rs. ${Number(value).toLocaleString()}`, name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: `${chartTheme.legendFontSize}px` }} />
                    <Bar
                      yAxisId="left"
                      dataKey="total"
                      name="Monthly spend"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={48}
                    >
                      {chartData.map((entry) => (
                        <Cell key={entry.label} fill={entry.fill} />
                      ))}
                    </Bar>
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="wantPct"
                      name="Want share"
                      stroke={chartTheme.copper}
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: chartTheme.copper }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {Array.from(new Set(result.months.map((m) => m.cluster))).map((cluster) => (
                  <span
                    key={cluster}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: clusterColor(cluster) }}
                    />
                    Cluster {cluster}
                  </span>
                ))}
              </div>
            </PageCard>

            <div className="space-y-6">
              <PageCard title="Behavioral score" badge={<PageBadge tone={scoreTone(behaviorScore)}>{scoreLabel(behaviorScore)}</PageBadge>}>
                <div className="flex items-end gap-3">
                  <span className="text-4xl font-display font-semibold text-slate-100">{behaviorScore}</span>
                  <span className="text-sm text-slate-400 pb-1">/ 100</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${behaviorScore}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Based on want share, cluster stability, and silhouette clarity across {result.months.length} analyzed
                  months.
                </p>
              </PageCard>

              <PageCard title="Top shifted patterns" subtitle="Largest mix changes month over month">
                {shifts.length === 0 ? (
                  <p className="text-sm text-slate-400">No major shifts detected — spending mix stayed consistent.</p>
                ) : (
                  <ul className="space-y-3">
                    {shifts.map((shift) => (
                      <li
                        key={`${shift.month}-${shift.label}`}
                        className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-200">{formatBehaviorMonth(shift.month)}</span>
                          <TrendingUp
                            className={`w-3.5 h-3.5 shrink-0 ${shift.delta >= 0 ? 'text-amber-400' : 'text-emerald-400'}`}
                          />
                        </div>
                        <p className="text-sm font-medium text-slate-100">{shift.label}</p>
                        <p className="text-xs text-slate-400">{shift.shift}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </PageCard>

              <PageCard
                title="AI suggestion"
                badge={<PageBadge tone="best">RECOMMENDED</PageBadge>}
              >
                <div className="flex gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shrink-0 h-fit">
                    <Lightbulb className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{result.intervention}</p>
                </div>
                <div className="pt-2 border-t border-slate-800">
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Focus area: {result.topCategory}
                  </p>
                </div>
              </PageCard>
            </div>
          </div>

          <PageCard
            title="Analysis history"
            subtitle="Recent months, spending mix changes, and recommendations"
            badge={<PageBadge tone="neutral">{result.months.length} MONTHS</PageBadge>}
          >
            <div className="overflow-x-auto -mx-2">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left">
                    <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Month</th>
                    <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Total spend</th>
                    <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Cluster</th>
                    <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Want %</th>
                    <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Mix change</th>
                    <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={row.month} className="border-b border-slate-800/80 last:border-0 hover:bg-slate-950/50">
                      <td className="px-3 py-3 font-medium text-slate-100">{row.label}</td>
                      <td className="px-3 py-3 text-slate-200">Rs. {row.total.toLocaleString()}</td>
                      <td className="px-3 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border border-slate-800"
                          style={{ color: clusterColor(row.cluster) }}
                        >
                          <Activity className="w-3 h-3" />
                          {row.cluster}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-300">{Math.round(row.wantShare * 100)}%</td>
                      <td className="px-3 py-3">
                        {row.wantDelta === 0 && row.totalDelta === 0 ? (
                          <span className="text-slate-500">—</span>
                        ) : (
                          <span className={row.wantDelta > 0 || row.totalDelta > 10 ? 'text-amber-400' : 'text-emerald-400'}>
                            {row.wantDelta !== 0
                              ? `${row.wantDelta > 0 ? '+' : ''}${Math.round(row.wantDelta * 100)}% want`
                              : `${row.totalDelta > 0 ? '+' : ''}${Math.round(row.totalDelta)}% spend`}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-400 text-xs max-w-[200px]">{row.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PageCard>
        </>
      )}
    </PageShell>
  );
}
