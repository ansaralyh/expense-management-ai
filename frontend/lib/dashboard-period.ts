import { currentMonthKey } from './ledger-events';
import type { SummaryResponse } from '../services/summary.service';

export type SummaryRange = 'all' | 'last3' | 'last6' | 'thisYear';
export type DashboardPeriodValue = SummaryRange | string;

export const PERIOD_PRESETS: { value: SummaryRange; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'last3', label: 'Last 3 Months' },
  { value: 'last6', label: 'Last 6 Months' },
  { value: 'thisYear', label: 'This Year' },
];

export function parseDashboardPeriod(value: DashboardPeriodValue): {
  range?: SummaryRange;
  month?: string;
} {
  if (value === 'all' || value === 'last3' || value === 'last6' || value === 'thisYear') {
    return { range: value };
  }
  return { month: value };
}

export function formatMonthKey(monthKey: string) {
  const date = new Date(`${monthKey}-01T00:00:00.000Z`);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function getPeriodDisplayLabel(value: DashboardPeriodValue) {
  const preset = PERIOD_PRESETS.find((item) => item.value === value);
  if (preset) return preset.label;
  if (/^\d{4}-\d{2}$/.test(value)) return formatMonthKey(value);
  return 'All Time';
}

export function buildRecentMonthOptions(count = 24): { value: string; label: string }[] {
  const anchor = currentMonthKey();
  const [year, month] = anchor.split('-').map(Number);
  const options: { value: string; label: string }[] = [];

  for (let i = 0; i < count; i += 1) {
    const date = new Date(Date.UTC(year, month - 1 - i, 1));
    const value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    options.push({ value, label });
  }

  return options;
}

export function getPeriodCardTitles(period: SummaryResponse['currentMonth'] | undefined) {
  if (!period) {
    return { income: 'Income', expense: 'Expenses', savings: 'Net savings' };
  }

  if (period.range === 'all') {
    return {
      income: 'All-Time Income',
      expense: 'All-Time Expenses',
      savings: 'Lifetime Net Savings',
    };
  }

  const label = period.label;
  return {
    income: `Income · ${label}`,
    expense: `Expenses · ${label}`,
    savings: `Net savings · ${label}`,
  };
}

export function getPeriodOverviewText(period: SummaryResponse['currentMonth'] | undefined) {
  if (!period) {
    return 'Totals come from the income and expense entries on your account.';
  }

  if (period.range === 'all') {
    const count = period.monthCount ?? 0;
    return count > 0
      ? `All-time totals across ${count} month${count === 1 ? '' : 's'} of saved transactions.`
      : 'All-time totals from your saved income and expenses.';
  }

  if (period.range) {
    return `Totals for ${period.label.toLowerCase()} from your saved income and expenses.`;
  }

  return `Totals for ${period.label} from your saved income and expenses.`;
}

export function getIncomeSubtext(
  period: SummaryResponse['currentMonth'] | undefined,
  incomeChangePercent: number,
  incomeUp: boolean
) {
  if (!period) return null;

  if (period.range === 'all') {
    const count = period.monthCount ?? 0;
    return count > 0
      ? `Recorded across ${count} month${count === 1 ? '' : 's'} of history`
      : 'Total recorded income';
  }

  if (period.range === 'last3' || period.range === 'last6') {
    return `${Math.abs(incomeChangePercent)}% vs prior ${period.range === 'last3' ? '3' : '6'} months`;
  }

  if (period.range === 'thisYear') {
    return incomeChangePercent === 0
      ? `Year-to-date through ${period.label.match(/\((\d{4})\)/)?.[1] || 'now'}`
      : `${Math.abs(incomeChangePercent)}% vs prior period`;
  }

  return `${Math.abs(incomeChangePercent)}% vs last month`;
}

export function getChartSubtitle(monthly: SummaryResponse['monthly']) {
  if (monthly.length === 0) return 'No ledger data yet';
  if (monthly.length === 1) return `${monthly[0].month} from your ledger`;
  return `${monthly[0].month}–${monthly[monthly.length - 1].month} from your ledger`;
}

export function shouldShowForecastOnChart(periodValue: DashboardPeriodValue) {
  return periodValue === currentMonthKey();
}

export function getDeficitBannerTitle(period: SummaryResponse['currentMonth'] | undefined) {
  if (!period || period.range === 'all') return 'Deficit detected';
  if (period.range) return `${period.label} deficit detected`;
  return 'Monthly deficit detected';
}
