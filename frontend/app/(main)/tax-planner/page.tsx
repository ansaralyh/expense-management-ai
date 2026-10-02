'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Download,
  FileText,
  HelpCircle,
  Info,
  Pencil,
  PiggyBank,
  Scale,
  TrendingUp,
  X,
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
import { advancedService, TaxEstimate } from '../../../services/advanced.service';
import { ApiError } from '../../../lib/api';
import {
  computeNisab,
  computeTaxPlan,
  computeZakat,
  downloadTextFile,
  exportTaxSummaryCsv,
  formatRs,
  PlannerTab,
  printTaxSummary,
  SALARIED_SLABS,
  seedFromEstimate,
  TaxInputs,
  ZakatAsset,
  ZakatAssetCategory,
  ZakatInputs,
} from '../../../lib/tax-planner-utils';

const TABS: { id: PlannerTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'salary', label: 'Salary tax planner' },
  { id: 'zakat', label: 'Zakat calculator' },
];

const ZAKAT_CATEGORY_LABELS: Record<ZakatAssetCategory, string> = {
  cash: 'Cash in bank',
  gold: 'Gold / silver',
  stocks: 'Stocks',
  savingsGoals: 'Savings goals',
  debts: 'Debts / liabilities',
  other: 'Other',
};

function Tooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex ml-1 align-middle">
      <HelpCircle className="w-3.5 h-3.5 text-slate-500 cursor-help" />
      <span className="pointer-events-none absolute left-1/2 bottom-full z-20 mb-2 w-56 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[11px] leading-relaxed text-slate-300 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

function SlabProgressBar({ income }: { income: number }) {
  const active = SALARIED_SLABS.find((row) => income <= row.upTo) || SALARIED_SLABS[SALARIED_SLABS.length - 1];
  const index = SALARIED_SLABS.indexOf(active);
  const next = SALARIED_SLABS[index + 1];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {SALARIED_SLABS.map((slab, slabIndex) => (
          <div
            key={slab.label}
            className={`flex-1 min-w-[80px] h-2 rounded-full ${
              slabIndex === index ? 'bg-emerald-500' : slabIndex < index ? 'bg-slate-600' : 'bg-slate-800'
            }`}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>
          Active slab: <strong className="text-slate-200">{active.label}</strong>
        </span>
        <span>Marginal rate: {Math.round(active.rate * 100)}%</span>
        {next && Number.isFinite(next.upTo) ? (
          <span>
            {formatRs(Math.max(0, next.upTo - income))} until next bracket
          </span>
        ) : null}
      </div>
    </div>
  );
}

function TaxInputsDrawer({
  open,
  taxInputs,
  onChange,
  onClose,
}: {
  open: boolean;
  taxInputs: TaxInputs;
  onChange: (next: TaxInputs) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  const field = (label: string, key: keyof TaxInputs, hint?: string) => (
    <label className="block space-y-1.5 text-sm">
      <span className="text-slate-400 font-medium">{label}</span>
      <input
        type="number"
        min={0}
        value={taxInputs[key]}
        onChange={(e) => onChange({ ...taxInputs, [key]: Number(e.target.value) || 0 })}
        className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
      />
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/60 backdrop-blur-sm">
      <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Edit tax inputs</h2>
            <p className="text-xs text-slate-400 mt-0.5">Changes recalculate instantly</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-md hover:bg-slate-800 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {field('Gross salary (annual)', 'grossSalary', 'Base salaried income for the tax year')}
          {field('Allowances (annual)', 'allowances', 'Taxable allowances and benefits')}
          {field('Tax deductions', 'taxDeductions', 'Standard deductions, provident fund, etc.')}
          {field('Exemptions', 'exemptions', 'Additional exempt amounts')}
          {field('Zakat tax credit', 'zakatTaxCredit', 'Zakat paid — deductible from income tax (Pakistan)')}
        </div>
        <div className="p-5 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-md bg-ink-900 hover:bg-ink-800 text-white font-medium text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function incomeSourceLabel(source: TaxEstimate['incomeSource']) {
  if (source === 'ledger') return 'Tax year ledger';
  if (source === 'rolling12') return 'Last 12 months';
  return 'Profile estimate';
}

export default function TaxPlannerPage() {
  const [estimate, setEstimate] = useState<TaxEstimate | null>(null);
  const [taxInputs, setTaxInputs] = useState<TaxInputs | null>(null);
  const [zakatInputs, setZakatInputs] = useState<ZakatInputs | null>(null);
  const [activeTab, setActiveTab] = useState<PlannerTab>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const run = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await advancedService.tax();
      setEstimate(result.estimate);
      const seeded = seedFromEstimate(result.estimate);
      setTaxInputs(seeded.taxInputs);
      setZakatInputs(seeded.zakatInputs);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to estimate tax.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void run();
  }, []);

  const zakat = useMemo(() => (zakatInputs ? computeZakat(zakatInputs) : null), [zakatInputs]);
  const tax = useMemo(
    () => (taxInputs && zakat ? computeTaxPlan(taxInputs, zakat.zakatDue) : null),
    [taxInputs, zakat]
  );

  const updateAsset = (id: string, patch: Partial<ZakatAsset>) => {
    if (!zakatInputs) return;
    setZakatInputs({
      ...zakatInputs,
      assets: zakatInputs.assets.map((asset) => (asset.id === id ? { ...asset, ...patch } : asset)),
    });
  };

  const addAsset = () => {
    if (!zakatInputs) return;
    setZakatInputs({
      ...zakatInputs,
      assets: [
        ...zakatInputs.assets,
        {
          id: `custom-${Date.now()}`,
          name: 'Custom asset',
          category: 'other',
          value: 0,
          eligible: true,
        },
      ],
    });
  };

  const handleExportCsv = () => {
    if (!estimate || !tax || !zakat || !taxInputs) return;
    const csv = exportTaxSummaryCsv({ taxYear: estimate.taxYear, tax, zakat, taxInputs });
    downloadTextFile(csv, `smartfin-tax-zakat-${estimate.taxYear}.csv`, 'text/csv;charset=utf-8');
  };

  const handleExportPdf = () => {
    if (!estimate || !tax || !zakat) return;
    printTaxSummary({ taxYear: estimate.taxYear, tax, zakat });
  };

  return (
    <PageShell>
      <PageHeader
        overline="Planning"
        title="Tax and zakat planner"
        description="Interactive Pakistan salaried tax estimate with zakat calculator, slab progress, and export."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              disabled={!taxInputs}
              className="px-4 py-2 rounded-md border border-slate-700 text-slate-200 text-sm font-medium flex items-center gap-2 hover:bg-slate-800 disabled:opacity-50"
            >
              <Pencil className="w-4 h-4" /> Edit inputs
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!tax}
              className="px-4 py-2 rounded-md border border-slate-700 text-slate-200 text-sm font-medium flex items-center gap-2 hover:bg-slate-800 disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={!tax}
              className="px-4 py-2 rounded-md border border-slate-700 text-slate-200 text-sm font-medium flex items-center gap-2 hover:bg-slate-800 disabled:opacity-50"
            >
              <FileText className="w-4 h-4" /> PDF
            </button>
            <PrimaryButton onClick={() => void run()} loading={loading} loadingLabel="Syncing…">
              Sync ledger
            </PrimaryButton>
          </div>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={() => void run()} /> : null}

      {loading && !estimate ? (
        <PageSkeleton rows={4} />
      ) : !estimate || !tax || !zakat || !taxInputs || !zakatInputs ? (
        <EmptyState
          icon={<FileText className="w-10 h-10" />}
          title="No tax estimate yet"
          description="Add income entries or set your profile monthly income, then calculate."
          action={
            <PrimaryButton onClick={() => void run()} loading={loading}>
              Calculate now
            </PrimaryButton>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 p-1 rounded-xl bg-slate-900 border border-slate-800 w-fit">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-slate-800 text-slate-100 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <MetricCard
                  label={`Tax year ${estimate.taxYear}`}
                  value={formatRs(tax.netTaxLiability)}
                  hint={`Gross tax ${formatRs(tax.annualTax)} · after zakat credit`}
                  badge={tax.netTaxLiability === 0 ? 'EXEMPT' : 'NET TAX'}
                  badgeTone={tax.netTaxLiability === 0 ? 'best' : 'neutral'}
                />
                <MetricCard
                  label="YTD income"
                  value={formatRs(estimate.ytdIncome)}
                  hint={`${incomeSourceLabel(estimate.incomeSource)} · ${estimate.monthsCounted} mo.`}
                  badge="YTD"
                />
                <MetricCard
                  label="Monthly set-aside"
                  value={formatRs(tax.monthlyWithholding)}
                  hint="Net liability ÷ 12"
                  badge="ESTIMATED"
                />
                <MetricCard
                  label="Zakat due"
                  value={formatRs(zakat.zakatDue)}
                  hint={`Base ${formatRs(zakat.netBase)} · nisab ${formatRs(zakat.nisab)}`}
                  badge={zakat.zakatDue > 0 ? 'ZAKAT' : 'BELOW NISAB'}
                  badgeTone={zakat.zakatDue > 0 ? 'best' : 'neutral'}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PageCard title="Tax snapshot" subtitle="Live from your edited inputs">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <p className="text-xs text-slate-400">Taxable income</p>
                      <p className="font-semibold text-slate-100 mt-1">{formatRs(tax.taxableIncome)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <p className="text-xs text-slate-400 flex items-center">
                        Effective rate
                        <Tooltip text="Annual tax divided by taxable income — your average tax burden across all slabs." />
                      </p>
                      <p className="font-semibold text-slate-100 mt-1">{tax.effectiveRate}%</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <p className="text-xs text-slate-400">Zakat tax credit</p>
                      <p className="font-semibold text-emerald-400 mt-1">{formatRs(tax.zakatCredit)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <p className="text-xs text-slate-400">Net tax liability</p>
                      <p className="font-semibold text-slate-100 mt-1">{formatRs(tax.netTaxLiability)}</p>
                    </div>
                  </div>
                </PageCard>

                <PageCard title="Zakat snapshot">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Eligible assets</span>
                      <span className="text-slate-100">{formatRs(zakat.eligibleTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Less liabilities</span>
                      <span className="text-slate-100">− {formatRs(zakat.debtTotal)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-2 font-medium">
                      <span className="text-slate-300 flex items-center">
                        Zakat base
                        <Tooltip text="Sum of eligible assets minus debts. Zakat (2.5%) applies when base exceeds nisab." />
                      </span>
                      <span className="text-slate-100">{formatRs(zakat.netBase)}</span>
                    </div>
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

          {activeTab === 'salary' && (
            <div className="space-y-6">
              <PageCard
                title="Salary tax planner"
                subtitle="Pakistan salaried slab structure (July–June tax year)"
                badge={
                  <PageBadge tone={tax.marginalRate === 0 ? 'best' : 'info'}>
                    {tax.marginalRate === 0 ? '0% MARGINAL' : `${tax.marginalRate}% MARGINAL`}
                  </PageBadge>
                }
              >
                <SlabProgressBar income={tax.taxableIncome} />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                  {[
                    { label: 'Gross + allowances', value: formatRs(taxInputs.grossSalary + taxInputs.allowances) },
                    { label: 'Less deductions', value: `− ${formatRs(taxInputs.taxDeductions + taxInputs.exemptions)}` },
                    { label: 'Taxable income', value: formatRs(tax.taxableIncome) },
                    { label: 'Annual tax (gross)', value: formatRs(tax.annualTax) },
                  ].map((item) => (
                    <div key={item.label} className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                      <p className="text-xs uppercase tracking-wider text-slate-400">{item.label}</p>
                      <p className="text-sm font-semibold text-slate-100 mt-1">{item.value}</p>
                    </div>
                  ))}
                </div>

                {tax.exemptionRemaining > 0 && (
                  <div className="flex gap-3 p-4 mt-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <Info className="w-5 h-5 text-emerald-400 shrink-0" />
                    <p className="text-sm text-slate-300">
                      Income is Rs. {tax.exemptionRemaining.toLocaleString()} below the Rs. 600,000 exemption slab.
                    </p>
                  </div>
                )}
              </PageCard>

              <PageCard title="Net liability after zakat credit">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border border-slate-800 bg-slate-950">
                    <p className="text-xs text-slate-400">Gross annual tax</p>
                    <p className="text-xl font-semibold text-slate-100 mt-1">{formatRs(tax.annualTax)}</p>
                  </div>
                  <div className="p-4 rounded-lg border border-slate-800 bg-slate-950">
                    <p className="text-xs text-slate-400 flex items-center">
                      Zakat credit applied
                      <Tooltip text="Under Pakistani rules, zakat paid on eligible wealth may reduce income tax liability." />
                    </p>
                    <p className="text-xl font-semibold text-emerald-400 mt-1">− {formatRs(tax.zakatCredit)}</p>
                  </div>
                  <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                    <p className="text-xs text-slate-400">Net tax liability</p>
                    <p className="text-xl font-semibold text-slate-100 mt-1">{formatRs(tax.netTaxLiability)}</p>
                    <p className="text-xs text-slate-500 mt-1">{formatRs(tax.monthlyWithholding)} / month</p>
                  </div>
                </div>
              </PageCard>
            </div>
          )}

          {activeTab === 'zakat' && (
            <div className="space-y-6">
              <PageCard title="Nisab settings" subtitle="Threshold before zakat becomes due">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="space-y-1.5 text-sm">
                    <span className="text-slate-400 font-medium">Nisab mode</span>
                    <select
                      value={zakatInputs.nisabMode}
                      onChange={(e) =>
                        setZakatInputs({
                          ...zakatInputs,
                          nisabMode: e.target.value as ZakatInputs['nisabMode'],
                        })
                      }
                      className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                    >
                      <option value="manual">Manual amount</option>
                      <option value="gold">Gold-based (87.48g)</option>
                    </select>
                  </label>
                  {zakatInputs.nisabMode === 'manual' ? (
                    <label className="space-y-1.5 text-sm">
                      <span className="text-slate-400 font-medium">Nisab (Rs.)</span>
                      <input
                        type="number"
                        min={0}
                        value={zakatInputs.nisabManual}
                        onChange={(e) =>
                          setZakatInputs({ ...zakatInputs, nisabManual: Number(e.target.value) || 0 })
                        }
                        className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                      />
                    </label>
                  ) : (
                    <>
                      <label className="space-y-1.5 text-sm">
                        <span className="text-slate-400 font-medium">Gold rate / gram (Rs.)</span>
                        <input
                          type="number"
                          min={0}
                          value={zakatInputs.goldRatePerGram}
                          onChange={(e) =>
                            setZakatInputs({ ...zakatInputs, goldRatePerGram: Number(e.target.value) || 0 })
                          }
                          className="w-full p-2.5 rounded-md bg-slate-950 border border-slate-800 text-slate-100"
                        />
                      </label>
                      <div className="p-2.5 rounded-md bg-slate-950 border border-slate-800 text-sm">
                        <p className="text-xs text-slate-400">Computed nisab</p>
                        <p className="font-semibold text-slate-100 mt-1">{formatRs(computeNisab(zakatInputs))}</p>
                      </div>
                    </>
                  )}
                </div>
              </PageCard>

              <PageCard
                title="Asset register"
                subtitle="Toggle eligibility and edit values — recalculates instantly"
                badge={<PageBadge tone="info">2.5% on eligible base</PageBadge>}
              >
                <div className="flex justify-end -mt-2">
                  <button
                    type="button"
                    onClick={addAsset}
                    className="text-xs font-medium text-emerald-400 hover:underline"
                  >
                    + Add asset
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-400">
                        <th className="py-2 pr-3">Eligible</th>
                        <th className="py-2 pr-3">Asset</th>
                        <th className="py-2 pr-3">Category</th>
                        <th className="py-2 pr-3 text-right">Value (Rs.)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {zakatInputs.assets.map((asset) => (
                        <tr key={asset.id} className={asset.eligible ? '' : 'opacity-60'}>
                          <td className="py-2.5 pr-3">
                            <input
                              type="checkbox"
                              checked={asset.eligible}
                              onChange={(e) => updateAsset(asset.id, { eligible: e.target.checked })}
                              className="rounded border-slate-600"
                            />
                          </td>
                          <td className="py-2.5 pr-3">
                            <input
                              type="text"
                              value={asset.name}
                              onChange={(e) => updateAsset(asset.id, { name: e.target.value })}
                              className="w-full min-w-[140px] p-1.5 rounded bg-slate-950 border border-slate-800 text-slate-100 text-sm"
                            />
                          </td>
                          <td className="py-2.5 pr-3">
                            <select
                              value={asset.category}
                              onChange={(e) =>
                                updateAsset(asset.id, { category: e.target.value as ZakatAssetCategory })
                              }
                              className="p-1.5 rounded bg-slate-950 border border-slate-800 text-slate-100 text-sm"
                            >
                              {Object.entries(ZAKAT_CATEGORY_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 pr-3 text-right">
                            <input
                              type="number"
                              min={0}
                              value={asset.value}
                              onChange={(e) => updateAsset(asset.id, { value: Number(e.target.value) || 0 })}
                              className="w-28 p-1.5 rounded bg-slate-950 border border-slate-800 text-slate-100 text-sm text-right ml-auto"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-800">
                  <div className="flex items-center gap-2 text-sm">
                    <PiggyBank className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-400">Eligible</span>
                    <span className="ml-auto font-medium text-slate-100">{formatRs(zakat.eligibleTotal)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Scale className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-400">Liabilities</span>
                    <span className="ml-auto font-medium text-slate-100">{formatRs(zakat.debtTotal)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Banknote className="w-4 h-4 text-emerald-400" />
                    <span className="text-slate-300 font-medium">Zakat due</span>
                    <span className="ml-auto font-semibold text-emerald-400">{formatRs(zakat.zakatDue)}</span>
                  </div>
                </div>

                {zakat.exemptAssets.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="text-xs text-slate-500">Exempt:</span>
                    {zakat.exemptAssets.map((asset) => (
                      <span
                        key={asset.id}
                        className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 text-slate-400"
                      >
                        {asset.name}
                      </span>
                    ))}
                  </div>
                )}
              </PageCard>

              <PageCard title="How zakat base is calculated">
                <div className="flex gap-3 text-sm text-slate-300">
                  <TrendingUp className="w-5 h-5 text-slate-400 shrink-0" />
                  <p className="leading-relaxed">
                    Eligible assets ({formatRs(zakat.eligibleTotal)}) minus liabilities ({formatRs(zakat.debtTotal)}) =
                    net base {formatRs(zakat.netBase)}. If net base ≥ nisab ({formatRs(zakat.nisab)}), zakat is 2.5% =
                    {formatRs(zakat.zakatDue)}.
                  </p>
                </div>
              </PageCard>
            </div>
          )}
        </>
      )}

      {taxInputs && (
        <TaxInputsDrawer
          open={editOpen}
          taxInputs={taxInputs}
          onChange={setTaxInputs}
          onClose={() => setEditOpen(false)}
        />
      )}
    </PageShell>
  );
}
