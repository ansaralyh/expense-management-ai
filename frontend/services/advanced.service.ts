import { apiRequest } from '../lib/api';

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

export type BehaviorMonth = {
  month: string;
  total: number;
  cluster: number;
  wantShare: number;
};

export type BehaviorResult = {
  status: string;
  model: string;
  profile: string;
  topCategory: string;
  wantShare: number;
  cluster?: number;
  clusterCount?: number;
  silhouette: number | null;
  intervention: string;
  months: BehaviorMonth[];
};

export type StatementLine = { date: string; amount: number; description: string };

export type ReconcileResult = {
  status: string;
  matched: {
    statement: StatementLine;
    expenseDescription: string;
    expenseDate: string;
    score: number;
  }[];
  statementOnly: StatementLine[];
  ledgerOnly: { id: string; date: string; amount: number; description: string }[];
  counts: { matched: number; statementOnly: number; ledgerOnly: number };
};

export type ForecastBand = {
  month: string;
  p10: number;
  p50: number;
  p90: number;
};

export type ForecastLabResult = {
  status: string;
  model: string;
  monthsUsed: number;
  draws: number;
  r2: number;
  history: { month: string; total: number }[];
  bands: ForecastBand[];
};

export type LifePlanResult = {
  years: number;
  paths: number;
  startNetWorth: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlyDebt: number;
  ending: { p10: number; p50: number; p90: number };
  yearly: { year: number; p10: number; p50: number; p90: number }[];
  goalReachPercent: number;
};

export const advancedService = {
  tax() {
    return apiRequest<{ status: string; estimate: TaxEstimate }>('/api/tax-planner');
  },
  behavior() {
    return apiRequest<BehaviorResult>('/api/behavior', { method: 'POST' });
  },
  forecast() {
    return apiRequest<ForecastLabResult>('/api/forecast-lab', { method: 'POST' });
  },
  reconcile(csv: string) {
    return apiRequest<ReconcileResult>('/api/reconcile', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    });
  },
  importMissing(rows: StatementLine[]) {
    return apiRequest<{ status: string; message: string; created: number }>('/api/reconcile/import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },
  lifePlan(years: number, annualIncomeGrowth: number, annualInflation: number) {
    return apiRequest<{ status: string; plan: LifePlanResult }>('/api/life-plan', {
      method: 'POST',
      body: JSON.stringify({ years, annualIncomeGrowth, annualInflation }),
    });
  },
};
