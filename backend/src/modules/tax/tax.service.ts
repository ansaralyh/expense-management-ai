import { AppError } from '../../utils/AppError.js';
import { isDatabaseConnected } from '../../config/db.js';
import { User } from '../auth/user.model.js';
import { Income } from '../income/income.model.js';
import { SavingsGoal } from '../goal/goal.model.js';
import { NetWorthItem } from '../networth/networth.model.js';

const NISAB_ESTIMATE_PKR = 200_000;
const ZAKAT_RATE = 0.025;

const SALARIED_SLABS = [
  { upTo: 600_000, base: 0, rate: 0, over: 0, label: 'Up to Rs. 600,000' },
  { upTo: 1_200_000, base: 0, rate: 0.05, over: 600_000, label: 'Rs. 600,001 – 1,200,000' },
  { upTo: 2_200_000, base: 30_000, rate: 0.15, over: 1_200_000, label: 'Rs. 1,200,001 – 2,200,000' },
  { upTo: 3_200_000, base: 180_000, rate: 0.25, over: 2_200_000, label: 'Rs. 2,200,001 – 3,200,000' },
  { upTo: 4_100_000, base: 430_000, rate: 0.3, over: 3_200_000, label: 'Rs. 3,200,001 – 4,100,000' },
  { upTo: Number.POSITIVE_INFINITY, base: 700_000, rate: 0.35, over: 4_100_000, label: 'Above Rs. 4,100,000' },
];

export type TaxSlabInfo = {
  label: string;
  ratePercent: number;
  appliesTo: number;
};

export type ZakatBreakdown = {
  savingsGoals: number;
  liquidAssets: number;
  total: number;
};

export type TaxEstimate = {
  taxYear: string;
  taxableIncome: number;
  ytdIncome: number;
  projectedAnnualIncome: number;
  incomeSource: 'ledger' | 'profile' | 'rolling12';
  monthsCounted: number;
  annualTax: number;
  monthlyWithholding: number;
  effectiveRate: number;
  marginalRate: number;
  exemptionRemaining: number;
  activeSlab: TaxSlabInfo;
  slabSource: string;
  zakatBase: number;
  zakatDue: number;
  nisab: number;
  zakatBreakdown: ZakatBreakdown;
  notes: string[];
};

function assertDatabase() {
  if (!isDatabaseConnected()) {
    throw new AppError('Database is not connected. Try again in a moment.', 503);
  }
}

function taxYearWindow(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const startYear = month >= 7 ? year : year - 1;
  return {
    label: `${startYear}-${String(startYear + 1).slice(2)}`,
    from: new Date(Date.UTC(startYear, 6, 1)),
    to: new Date(Date.UTC(startYear + 1, 6, 1)),
  };
}

function monthsElapsedInWindow(from: Date, to: Date, now = new Date()) {
  const end = now < to ? now : to;
  if (end < from) return 1;
  const months =
    (end.getUTCFullYear() - from.getUTCFullYear()) * 12 + (end.getUTCMonth() - from.getUTCMonth()) + 1;
  return Math.max(1, Math.min(12, months));
}

function rollingWindow(now = new Date()) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  return { from, to: now };
}

export function salariedTax(annualIncome: number) {
  const income = Math.max(0, annualIncome);
  const slab = SALARIED_SLABS.find((row) => income <= row.upTo) || SALARIED_SLABS[SALARIED_SLABS.length - 1];
  return Math.round(slab.base + Math.max(0, income - slab.over) * slab.rate);
}

function activeSlabFor(income: number): TaxSlabInfo {
  const slab = SALARIED_SLABS.find((row) => income <= row.upTo) || SALARIED_SLABS[SALARIED_SLABS.length - 1];
  return {
    label: slab.label,
    ratePercent: Math.round(slab.rate * 100),
    appliesTo: Math.round(Math.max(0, income - slab.over)),
  };
}

function isLiquidAsset(category: string, name: string) {
  return /cash|saving|gold|bank|wallet|liquid|current|deposit/i.test(`${category} ${name}`);
}

export async function estimateTax(userId: string): Promise<TaxEstimate> {
  assertDatabase();
  const now = new Date();
  const window = taxYearWindow(now);
  const rolling = rollingWindow(now);

  const [user, taxYearIncomes, rollingIncomes, goals, assets] = await Promise.all([
    User.findById(userId).select('monthlyIncome'),
    Income.find({ userId, date: { $gte: window.from, $lt: window.to } }).select('amount'),
    Income.find({ userId, date: { $gte: rolling.from, $lte: rolling.to } }).select('amount'),
    SavingsGoal.find({ userId }).select('currentAmount'),
    NetWorthItem.find({ userId, kind: 'asset' }).select('name category value'),
  ]);

  const ytdIncome = Math.round(taxYearIncomes.reduce((sum, row) => sum + row.amount, 0));
  const rollingIncome = Math.round(rollingIncomes.reduce((sum, row) => sum + row.amount, 0));
  const profileIncome = Math.round((user?.monthlyIncome || 0) * 12);
  const monthsCounted = monthsElapsedInWindow(window.from, window.to, now);

  let incomeSource: TaxEstimate['incomeSource'] = 'profile';
  let ytdForDisplay = ytdIncome;

  if (ytdIncome > 0) {
    incomeSource = 'ledger';
    ytdForDisplay = ytdIncome;
  } else if (rollingIncome > 0) {
    incomeSource = 'rolling12';
    ytdForDisplay = rollingIncome;
  } else if (profileIncome > 0) {
    incomeSource = 'profile';
    ytdForDisplay = profileIncome;
  }

  const projectedAnnualIncome =
    incomeSource === 'ledger'
      ? Math.round((ytdIncome / monthsCounted) * 12)
      : incomeSource === 'rolling12'
        ? rollingIncome
        : profileIncome;

  const taxableIncome = projectedAnnualIncome;
  const annualTax = salariedTax(taxableIncome);
  const activeSlab = activeSlabFor(taxableIncome);
  const exemptionRemaining = Math.max(0, 600_000 - taxableIncome);

  const savingsGoals = Math.round(goals.reduce((sum, goal) => sum + goal.currentAmount, 0));
  const liquidAssets = Math.round(
    assets.filter((item) => isLiquidAsset(item.category, item.name)).reduce((sum, item) => sum + item.value, 0)
  );
  const zakatBase = savingsGoals + liquidAssets;
  const zakatDue = zakatBase >= NISAB_ESTIMATE_PKR ? Math.round(zakatBase * ZAKAT_RATE) : 0;

  const notes: string[] = [];

  if (incomeSource === 'ledger') {
    notes.push(
      `Tax year (${window.label}): Rs. ${ytdIncome.toLocaleString()} recorded across ${monthsCounted} month${monthsCounted === 1 ? '' : 's'} (Jul–Jun).`
    );
    notes.push(
      `Projected annual income: Rs. ${projectedAnnualIncome.toLocaleString()} (YTD annualized for planning).`
    );
  } else if (incomeSource === 'rolling12') {
    notes.push(
      `No income entries in the current tax year yet. Using Rs. ${rollingIncome.toLocaleString()} from the last 12 months of ledger income.`
    );
  } else if (profileIncome > 0) {
    notes.push('No ledger income found. Using profile monthly income × 12.');
  } else {
    notes.push('Add income entries or set monthly income on your profile to see tax estimates.');
  }

  if (annualTax === 0 && taxableIncome > 0) {
    notes.push(
      exemptionRemaining > 0
        ? `Your projected income is below the Rs. 600,000 exemption — about Rs. ${exemptionRemaining.toLocaleString()} under the first slab.`
        : 'Your income falls in a zero-rate slab for this estimate.'
    );
  }

  if (zakatDue === 0) {
    notes.push(
      zakatBase > 0
        ? `Zakat base Rs. ${zakatBase.toLocaleString()} is below the estimated nisab (Rs. ${NISAB_ESTIMATE_PKR.toLocaleString()}).`
        : 'Add savings goals or liquid net-worth assets (cash, bank, gold) to calculate zakat.'
    );
  } else {
    notes.push('Zakat is 2.5% of eligible cash, savings goals, and liquid assets above nisab.');
  }

  return {
    taxYear: window.label,
    taxableIncome,
    ytdIncome: ytdForDisplay,
    projectedAnnualIncome,
    incomeSource,
    monthsCounted,
    annualTax,
    monthlyWithholding: Math.round(annualTax / 12),
    effectiveRate: taxableIncome === 0 ? 0 : Number(((annualTax / taxableIncome) * 100).toFixed(1)),
    marginalRate: activeSlab.ratePercent,
    exemptionRemaining,
    activeSlab,
    slabSource:
      'Salaried slab structure used as an estimate for Pakistan tax year planning. Confirm against the current Finance Act before filing.',
    zakatBase,
    zakatDue,
    nisab: NISAB_ESTIMATE_PKR,
    zakatBreakdown: {
      savingsGoals,
      liquidAssets,
      total: zakatBase,
    },
    notes,
  };
}
