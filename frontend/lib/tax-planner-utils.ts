import type { TaxEstimate } from '../services/advanced.service';

export const SALARIED_SLABS = [
  { upTo: 600_000, base: 0, rate: 0, over: 0, label: 'Up to Rs. 600,000' },
  { upTo: 1_200_000, base: 0, rate: 0.05, over: 600_000, label: 'Rs. 600,001 – 1,200,000' },
  { upTo: 2_200_000, base: 30_000, rate: 0.15, over: 1_200_000, label: 'Rs. 1,200,001 – 2,200,000' },
  { upTo: 3_200_000, base: 180_000, rate: 0.25, over: 2_200_000, label: 'Rs. 2,200,001 – 3,200,000' },
  { upTo: 4_100_000, base: 430_000, rate: 0.3, over: 3_200_000, label: 'Rs. 3,200,001 – 4,100,000' },
  { upTo: Number.POSITIVE_INFINITY, base: 700_000, rate: 0.35, over: 4_100_000, label: 'Above Rs. 4,100,000' },
] as const;

export type TaxInputs = {
  grossSalary: number;
  allowances: number;
  taxDeductions: number;
  exemptions: number;
  zakatTaxCredit: number;
};

export type ZakatAssetCategory =
  | 'cash'
  | 'gold'
  | 'stocks'
  | 'savingsGoals'
  | 'debts'
  | 'other';

export type ZakatAsset = {
  id: string;
  name: string;
  category: ZakatAssetCategory;
  value: number;
  eligible: boolean;
};

export type ZakatInputs = {
  nisabMode: 'manual' | 'gold';
  nisabManual: number;
  goldRatePerGram: number;
  goldNisabGrams: number;
  assets: ZakatAsset[];
};

export type PlannerTab = 'overview' | 'salary' | 'zakat';

export function formatRs(amount: number) {
  return `Rs. ${Math.round(amount).toLocaleString('en-US')}`;
}

export function salariedTax(annualIncome: number) {
  const income = Math.max(0, annualIncome);
  const slab = SALARIED_SLABS.find((row) => income <= row.upTo) || SALARIED_SLABS[SALARIED_SLABS.length - 1];
  return Math.round(slab.base + Math.max(0, income - slab.over) * slab.rate);
}

export function activeSlabFor(income: number) {
  const slab = SALARIED_SLABS.find((row) => income <= row.upTo) || SALARIED_SLABS[SALARIED_SLABS.length - 1];
  const index = SALARIED_SLABS.indexOf(slab);
  const nextSlab = SALARIED_SLABS[index + 1];
  return {
    label: slab.label,
    ratePercent: Math.round(slab.rate * 100),
    appliesTo: Math.round(Math.max(0, income - slab.over)),
    over: slab.over,
    upTo: slab.upTo,
    index,
    remainingToNext:
      nextSlab && Number.isFinite(nextSlab.upTo)
        ? Math.max(0, nextSlab.upTo - income)
        : 0,
    progressInSlab:
      nextSlab && Number.isFinite(slab.upTo) && slab.upTo !== Number.POSITIVE_INFINITY
        ? Math.min(100, ((income - slab.over) / (slab.upTo - slab.over)) * 100)
        : income > slab.over
          ? 100
          : 0,
  };
}

export function computeNisab(inputs: ZakatInputs) {
  if (inputs.nisabMode === 'gold') {
    return Math.round(inputs.goldRatePerGram * inputs.goldNisabGrams);
  }
  return Math.round(inputs.nisabManual);
}

export function computeZakat(inputs: ZakatInputs) {
  const nisab = computeNisab(inputs);
  const eligibleAssets = inputs.assets.filter((asset) => asset.eligible && asset.category !== 'debts');
  const debts = inputs.assets.filter((asset) => asset.category === 'debts' || (asset.eligible && asset.value < 0));

  const eligibleTotal = eligibleAssets.reduce((sum, asset) => sum + Math.max(0, asset.value), 0);
  const debtTotal = inputs.assets
    .filter((asset) => asset.category === 'debts')
    .reduce((sum, asset) => sum + Math.abs(asset.value), 0);

  const netBase = Math.max(0, eligibleTotal - debtTotal);
  const zakatDue = netBase >= nisab ? Math.round(netBase * 0.025) : 0;

  return {
    nisab,
    eligibleTotal,
    debtTotal,
    netBase,
    zakatDue,
    eligibleAssets,
    exemptAssets: inputs.assets.filter((asset) => !asset.eligible),
  };
}

export function computeTaxPlan(taxInputs: TaxInputs, zakatDue: number) {
  const taxableIncome = Math.max(
    0,
    taxInputs.grossSalary + taxInputs.allowances - taxInputs.taxDeductions - taxInputs.exemptions
  );
  const annualTax = salariedTax(taxableIncome);
  const activeSlab = activeSlabFor(taxableIncome);
  const zakatCredit = Math.min(Math.max(0, taxInputs.zakatTaxCredit || zakatDue), annualTax);
  const netTaxLiability = Math.max(0, annualTax - zakatCredit);
  const effectiveRate = taxableIncome === 0 ? 0 : Number(((annualTax / taxableIncome) * 100).toFixed(1));

  return {
    taxableIncome,
    annualTax,
    netTaxLiability,
    zakatCredit,
    monthlyWithholding: Math.round(netTaxLiability / 12),
    grossWithholding: Math.round(annualTax / 12),
    effectiveRate,
    marginalRate: activeSlab.ratePercent,
    activeSlab,
    exemptionRemaining: Math.max(0, 600_000 - taxableIncome),
  };
}

export function seedFromEstimate(estimate: TaxEstimate): { taxInputs: TaxInputs; zakatInputs: ZakatInputs } {
  const taxInputs: TaxInputs = {
    grossSalary: estimate.projectedAnnualIncome,
    allowances: 0,
    taxDeductions: 0,
    exemptions: 0,
    zakatTaxCredit: estimate.zakatDue,
  };

  const assets: ZakatAsset[] = [
    {
      id: 'savings-goals',
      name: 'Savings goals',
      category: 'savingsGoals',
      value: estimate.zakatBreakdown.savingsGoals,
      eligible: estimate.zakatBreakdown.savingsGoals > 0,
    },
    {
      id: 'liquid-assets',
      name: 'Liquid assets (cash / bank / gold)',
      category: 'cash',
      value: estimate.zakatBreakdown.liquidAssets,
      eligible: estimate.zakatBreakdown.liquidAssets > 0,
    },
    {
      id: 'gold',
      name: 'Gold / silver value',
      category: 'gold',
      value: 0,
      eligible: false,
    },
    {
      id: 'stocks',
      name: 'Stocks & investments',
      category: 'stocks',
      value: 0,
      eligible: false,
    },
    {
      id: 'debts',
      name: 'Debts & liabilities',
      category: 'debts',
      value: 0,
      eligible: true,
    },
  ];

  const zakatInputs: ZakatInputs = {
    nisabMode: 'manual',
    nisabManual: estimate.nisab,
    goldRatePerGram: 23000,
    goldNisabGrams: 87.48,
    assets,
  };

  return { taxInputs, zakatInputs };
}

export function exportTaxSummaryCsv(params: {
  taxYear: string;
  tax: ReturnType<typeof computeTaxPlan>;
  zakat: ReturnType<typeof computeZakat>;
  taxInputs: TaxInputs;
}) {
  const lines = [
    'SmartFin AI — Tax & Zakat Summary',
    `Tax year,${params.taxYear}`,
    '',
    'Salary tax',
    `Gross salary,${params.taxInputs.grossSalary}`,
    `Allowances,${params.taxInputs.allowances}`,
    `Deductions,${params.taxInputs.taxDeductions}`,
    `Exemptions,${params.taxInputs.exemptions}`,
    `Taxable income,${params.tax.taxableIncome}`,
    `Annual tax,${params.tax.annualTax}`,
    `Zakat tax credit,${params.tax.zakatCredit}`,
    `Net tax liability,${params.tax.netTaxLiability}`,
    `Effective rate,${params.tax.effectiveRate}%`,
    `Marginal rate,${params.tax.marginalRate}%`,
    '',
    'Zakat',
    `Nisab,${params.zakat.nisab}`,
    `Eligible base,${params.zakat.netBase}`,
    `Zakat due,${params.zakat.zakatDue}`,
    '',
    'Assets',
    'Name,Category,Value,Eligible',
    ...params.zakat.eligibleAssets.map(
      (asset) => `${asset.name},${asset.category},${asset.value},${asset.eligible ? 'yes' : 'no'}`
    ),
  ];
  return lines.join('\n');
}

export function downloadTextFile(content: string, filename: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function printTaxSummary(params: {
  taxYear: string;
  tax: ReturnType<typeof computeTaxPlan>;
  zakat: ReturnType<typeof computeZakat>;
}) {
  const html = `
    <!DOCTYPE html><html><head><title>Tax & Zakat Summary</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 32px; color: #111; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      p { color: #555; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background: #f5f5f5; }
    </style></head><body>
    <h1>Tax & Zakat Summary</h1>
    <p>Tax year ${params.taxYear}</p>
    <table>
      <tr><th colspan="2">Salary tax</th></tr>
      <tr><td>Taxable income</td><td>${formatRs(params.tax.taxableIncome)}</td></tr>
      <tr><td>Annual tax</td><td>${formatRs(params.tax.annualTax)}</td></tr>
      <tr><td>Zakat tax credit</td><td>${formatRs(params.tax.zakatCredit)}</td></tr>
      <tr><td>Net tax liability</td><td>${formatRs(params.tax.netTaxLiability)}</td></tr>
      <tr><td>Effective / marginal rate</td><td>${params.tax.effectiveRate}% / ${params.tax.marginalRate}%</td></tr>
    </table>
    <table>
      <tr><th colspan="2">Zakat</th></tr>
      <tr><td>Nisab</td><td>${formatRs(params.zakat.nisab)}</td></tr>
      <tr><td>Eligible base</td><td>${formatRs(params.zakat.netBase)}</td></tr>
      <tr><td>Zakat due</td><td>${formatRs(params.zakat.zakatDue)}</td></tr>
    </table>
    </body></html>`;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
