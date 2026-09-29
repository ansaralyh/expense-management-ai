'use client';

import { useMemo, useState } from 'react';
import { Scale } from 'lucide-react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  EmptyState,
  ErrorBanner,
  MetricCard,
  PageCard,
  PageHeader,
  PageShell,
  PageSkeleton,
  PrimaryButton,
} from '../../../components/layout/PageLayout';
import { advancedService, LifePlanResult } from '../../../services/advanced.service';
import { ApiError } from '../../../lib/api';
import { chartTheme, tooltipStyle } from '../../../lib/theme';

export default function LifePlanPage() {
  const [years, setYears] = useState(5);
  const [growth, setGrowth] = useState(5);
  const [inflation, setInflation] = useState(8);
  const [plan, setPlan] = useState<LifePlanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await advancedService.lifePlan(years, growth, inflation);
      setPlan(result.plan);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to run the life plan.');
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(
    () =>
      plan?.yearly.map((row) => ({
        year: `Y${row.year}`,
        low: row.p10,
        median: row.p50,
        high: row.p90,
      })) ?? [],
    [plan]
  );

  return (
    <PageShell>
      <PageHeader
        overline="Planning"
        title="Life plan"
        description="800 simulated paths using your average income, spending, debt payments, and savings goals."
        action={
          <PrimaryButton onClick={() => void run()} loading={loading} loadingLabel="Simulating…">
            Run paths
          </PrimaryButton>
        }
      />

      <PageCard title="Simulation inputs" subtitle="Adjust assumptions before running">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <label className="space-y-1.5 text-slate-400">
            Years
            <input
              type="number"
              min={1}
              max={10}
              value={years}
              onChange={(event) => setYears(Number(event.target.value))}
              className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
            />
          </label>
          <label className="space-y-1.5 text-slate-400">
            Income growth % / year
            <input
              type="number"
              min={-20}
              max={30}
              value={growth}
              onChange={(event) => setGrowth(Number(event.target.value))}
              className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
            />
          </label>
          <label className="space-y-1.5 text-slate-400">
            Inflation % / year
            <input
              type="number"
              min={0}
              max={25}
              value={inflation}
              onChange={(event) => setInflation(Number(event.target.value))}
              className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
            />
          </label>
        </div>
      </PageCard>

      {error ? <ErrorBanner message={error} onRetry={() => void run()} /> : null}

      {loading ? (
        <PageSkeleton rows={4} />
      ) : !plan ? (
        <EmptyState
          icon={<Scale className="w-10 h-10" />}
          title="No simulation yet"
          description="Set your assumptions above and run paths to see low, median, and high net-worth outcomes."
          action={
            <PrimaryButton onClick={() => void run()} loading={loading}>
              Run simulation
            </PrimaryButton>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <MetricCard label="Low path (p10)" value={`Rs. ${plan.ending.p10.toLocaleString()}`} badge="P10" />
            <MetricCard
              label="Median net worth"
              value={`Rs. ${plan.ending.p50.toLocaleString()}`}
              badge="BEST"
              badgeTone="best"
            />
            <MetricCard label="High path (p90)" value={`Rs. ${plan.ending.p90.toLocaleString()}`} badge="P90" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <PageCard
              className="lg:col-span-2"
              title="Net worth bands by year"
              subtitle={`Goals fully funded in ${plan.goalReachPercent}% of paths`}
            >
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={4} barCategoryGap="24%">
                    <XAxis dataKey="year" stroke={chartTheme.axis} fontSize={chartTheme.tickFontSize} tickLine={false} />
                    <YAxis
                      stroke={chartTheme.axis}
                      fontSize={chartTheme.tickFontSize}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `Rs.${v / 1000}k` : `Rs.${v}`)}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(val: number) => [`Rs. ${Number(val).toLocaleString()}`, '']}
                    />
                    <Bar dataKey="low" fill={chartTheme.mutedBar} name="Low" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="median" fill={chartTheme.sage} name="Median" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="high" fill={chartTheme.forecast} name="High" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </PageCard>

            <PageCard title="Starting position">
              <p className="text-sm text-slate-300 leading-relaxed">
                Starting net worth <strong className="text-slate-100">Rs. {plan.startNetWorth.toLocaleString()}</strong>.
                Monthly income Rs. {plan.monthlyIncome.toLocaleString()}, expenses Rs.{' '}
                {plan.monthlyExpense.toLocaleString()}, debt Rs. {plan.monthlyDebt.toLocaleString()}.
              </p>
              <p className="text-xs text-slate-500">
                {plan.paths} Monte Carlo paths over {plan.years} years.
              </p>
            </PageCard>
          </div>

          <PageCard title="Year-by-year range">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left">
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Year</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Low – High</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Median</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.yearly.map((row) => (
                    <tr key={row.year} className="border-b border-slate-800/80 last:border-0">
                      <td className="px-3 py-2.5 text-slate-100">Year {row.year}</td>
                      <td className="px-3 py-2.5 text-slate-400">
                        Rs. {row.p10.toLocaleString()} – {row.p90.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-emerald-400 font-medium">Rs. {row.p50.toLocaleString()}</td>
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
