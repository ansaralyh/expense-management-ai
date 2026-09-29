'use client';

import { useEffect, useState } from 'react';
import { FileText, Info, PiggyBank, Scale } from 'lucide-react';
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
import { advancedService, TaxEstimate } from '../../../services/advanced.service';
import { ApiError } from '../../../lib/api';

function incomeSourceLabel(source: TaxEstimate['incomeSource']) {
  if (source === 'ledger') return 'Tax year ledger';
  if (source === 'rolling12') return 'Last 12 months';
  return 'Profile estimate';
}

export default function TaxPlannerPage() {
  const [estimate, setEstimate] = useState<TaxEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const run = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await advancedService.tax();
      setEstimate(result.estimate);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to estimate tax.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void run();
  }, []);

  const hasIncome = (estimate?.projectedAnnualIncome ?? 0) > 0;

  return (
    <PageShell>
      <PageHeader
        overline="Planning"
        title="Tax and zakat planner"
        description="Pakistan salaried tax estimate for the current July–June year, plus zakat on cash and savings."
        action={
          <PrimaryButton onClick={() => void run()} loading={loading} loadingLabel="Calculating…">
            Recalculate
          </PrimaryButton>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={() => void run()} /> : null}

      {loading && !estimate ? (
        <PageSkeleton rows={3} />
      ) : !estimate ? (
        <EmptyState
          icon={<FileText className="w-10 h-10" />}
          title="No tax estimate yet"
          description="Add income entries or set your profile monthly income, then calculate to see tax and zakat estimates."
          action={
            <PrimaryButton onClick={() => void run()} loading={loading}>
              Calculate now
            </PrimaryButton>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <MetricCard
              label={`Tax year ${estimate.taxYear}`}
              value={`Rs. ${estimate.annualTax.toLocaleString()}`}
              hint={`Projected on Rs. ${estimate.projectedAnnualIncome.toLocaleString()}`}
              badge={estimate.annualTax === 0 ? 'EXEMPT' : 'ANNUAL'}
              badgeTone={estimate.annualTax === 0 ? 'best' : 'neutral'}
            />
            <MetricCard
              label="YTD income"
              value={`Rs. ${estimate.ytdIncome.toLocaleString()}`}
              hint={`${incomeSourceLabel(estimate.incomeSource)} · ${estimate.monthsCounted} mo.`}
              badge="YTD"
            />
            <MetricCard
              label="Monthly set-aside"
              value={`Rs. ${estimate.monthlyWithholding.toLocaleString()}`}
              hint={
                estimate.annualTax === 0
                  ? 'No withholding suggested at this income level'
                  : 'Suggested monthly withholding'
              }
              badge="ESTIMATED"
            />
            <MetricCard
              label="Zakat due"
              value={`Rs. ${estimate.zakatDue.toLocaleString()}`}
              hint={`Base Rs. ${estimate.zakatBreakdown.total.toLocaleString()} · nisab Rs. ${estimate.nisab.toLocaleString()}`}
              badge={estimate.zakatDue > 0 ? 'ZAKAT' : 'BELOW NISAB'}
              badgeTone={estimate.zakatDue > 0 ? 'best' : 'neutral'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <PageCard
              className="lg:col-span-2"
              title="Tax slab breakdown"
              subtitle="Based on projected annual salaried income"
              badge={
                <PageBadge tone={estimate.annualTax === 0 ? 'best' : 'info'}>
                  {estimate.marginalRate === 0 ? '0% MARGINAL' : `${estimate.marginalRate}% MARGINAL`}
                </PageBadge>
              }
            >
              {!hasIncome ? (
                <p className="text-sm text-slate-400">
                  No income data found. Add income on the Income page or set monthly income in your profile.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                      <p className="text-xs uppercase tracking-wider text-slate-400">Active slab</p>
                      <p className="text-sm font-semibold text-slate-100 mt-1">{estimate.activeSlab.label}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                      <p className="text-xs uppercase tracking-wider text-slate-400">Effective rate</p>
                      <p className="text-sm font-semibold text-slate-100 mt-1">{estimate.effectiveRate}%</p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                      <p className="text-xs uppercase tracking-wider text-slate-400">
                        {estimate.exemptionRemaining > 0 ? 'Below exemption by' : 'Taxable portion'}
                      </p>
                      <p className="text-sm font-semibold text-slate-100 mt-1">
                        {estimate.exemptionRemaining > 0
                          ? `Rs. ${estimate.exemptionRemaining.toLocaleString()}`
                          : `Rs. ${estimate.activeSlab.appliesTo.toLocaleString()}`}
                      </p>
                    </div>
                  </div>

                  {estimate.annualTax === 0 && estimate.exemptionRemaining > 0 && (
                    <div className="flex gap-3 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                      <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-300 leading-relaxed">
                        Your projected annual income of{' '}
                        <strong className="text-slate-100">
                          Rs. {estimate.projectedAnnualIncome.toLocaleString()}
                        </strong>{' '}
                        is within the Rs. 600,000 tax-free slab for salaried individuals. Estimated annual tax is{' '}
                        <strong className="text-emerald-400">Rs. 0</strong> — this is expected, not missing data.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </PageCard>

            <PageCard title="Zakat breakdown" badge={<PageBadge tone="info">2.5%</PageBadge>}>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400 flex items-center gap-2">
                    <PiggyBank className="w-4 h-4" /> Savings goals
                  </span>
                  <span className="text-slate-100 font-medium">
                    Rs. {estimate.zakatBreakdown.savingsGoals.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400 flex items-center gap-2">
                    <Scale className="w-4 h-4" /> Liquid assets
                  </span>
                  <span className="text-slate-100 font-medium">
                    Rs. {estimate.zakatBreakdown.liquidAssets.toLocaleString()}
                  </span>
                </div>
                <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-300 font-medium">Eligible base</span>
                  <span className="text-slate-100 font-semibold">
                    Rs. {estimate.zakatBreakdown.total.toLocaleString()}
                  </span>
                </div>
                {estimate.zakatDue === 0 && (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {estimate.zakatBreakdown.total === 0
                      ? 'Track savings goals or add cash/bank/gold items under Net Worth to calculate zakat.'
                      : `Total is below the nisab threshold of Rs. ${estimate.nisab.toLocaleString()}.`}
                  </p>
                )}
              </div>
            </PageCard>
          </div>

          <PageCard title="Notes and assumptions">
            <div className="text-sm text-slate-300 space-y-2">
              {estimate.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
              <p className="text-xs text-slate-500 pt-2 border-t border-slate-800">{estimate.slabSource}</p>
            </div>
          </PageCard>
        </>
      )}
    </PageShell>
  );
}
