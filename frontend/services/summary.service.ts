import { apiRequest } from '../lib/api';

export type CategoryTotal = {
  category: string;
  amount: number;
};

export type MonthlyPoint = {
  month: string;
  monthKey: string;
  income: number;
  expense: number;
  savings: number;
};

export type BudgetVariance = {
  id: string;
  category: string | null;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
  utilization: number;
  status: 'under' | 'on_track' | 'over';
};

export type SummaryRange = 'all' | 'last3' | 'last6' | 'thisYear';

export type SummaryGetOptions = {
  months?: number;
  month?: string;
  range?: SummaryRange;
};

export type SummaryResponse = {
  status: string;
  currentMonth: {
    key: string;
    label: string;
    income: number;
    expense: number;
    savings: number;
    savingsRate: number;
    needsTotal: number;
    wantsTotal: number;
    incomeChangePercent: number;
    expenseChangePercent: number;
    byCategory: CategoryTotal[];
    range?: SummaryRange | null;
    monthCount?: number;
  };
  monthly: MonthlyPoint[];
  byCategory: CategoryTotal[];
  budgetVariance: BudgetVariance[];
};

export const summaryService = {
  get(options: SummaryGetOptions | number = {}, month?: string) {
    const opts: SummaryGetOptions =
      typeof options === 'number' ? { months: options, month } : options;

    const params = new URLSearchParams({ months: String(opts.months ?? 6) });
    if (opts.month) params.set('month', opts.month);
    if (opts.range) params.set('range', opts.range);
    return apiRequest<SummaryResponse>(`/api/summary?${params.toString()}`);
  },
};
