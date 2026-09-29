import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import { isDatabaseConnected } from '../../config/db.js';
import { Income } from '../income/income.model.js';
import { Expense } from '../expense/expense.model.js';
import { listBudgets } from '../budget/budget.service.js';
import { summaryRangeValues } from './summary.validation.js';

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

export type SummaryRange = (typeof summaryRangeValues)[number];

export type SummaryOptions = {
  months?: number;
  month?: string;
  range?: SummaryRange;
};

function assertDatabase() {
  if (!isDatabaseConnected()) {
    throw new AppError('Database is not connected. Try again in a moment.', 503);
  }
}

function monthKeyFromDate(value: Date) {
  return value.toISOString().slice(0, 7);
}

function monthLabel(monthKey: string) {
  if (monthKey === 'all') return 'All Time';
  const date = new Date(`${monthKey}-01T00:00:00.000Z`);
  return date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
}

function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthKeys(count: number, currentKey: string) {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    keys.push(shiftMonth(currentKey, -i));
  }
  return keys;
}

function yearMonthKeys(year: string, throughKey: string) {
  const through = throughKey.startsWith(year) ? throughKey : `${year}-12`;
  const [, endMonth] = through.split('-').map(Number);
  const keys: string[] = [];
  for (let month = 1; month <= endMonth; month += 1) {
    keys.push(`${year}-${String(month).padStart(2, '0')}`);
  }
  return keys;
}

function periodLabel(range: SummaryRange | undefined, anchorKey: string, keyCount: number) {
  if (range === 'all') return 'All Time';
  if (range === 'last3') return 'Last 3 Months';
  if (range === 'last6') return 'Last 6 Months';
  if (range === 'thisYear') return `This Year (${anchorKey.slice(0, 4)})`;
  return monthLabel(anchorKey);
}

function periodKey(range: SummaryRange | undefined, anchorKey: string) {
  if (range === 'all') return 'all';
  if (range === 'last3') return 'last3';
  if (range === 'last6') return 'last6';
  if (range === 'thisYear') return `year-${anchorKey.slice(0, 4)}`;
  return anchorKey;
}

function percentChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function sumForKeys(map: Record<string, number>, keys: string[]) {
  return keys.reduce((sum, key) => sum + (map[key] || 0), 0);
}

export async function getSummary(userId: string, options: SummaryOptions = {}) {
  assertDatabase();

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError('User not found.', 404);
  }

  const chartWindow = options.months ?? 6;
  const anchorKey = options.month || monthKeyFromDate(new Date());
  const range = options.range;
  const ownerId = new mongoose.Types.ObjectId(userId);

  const [incomes, expenses] = await Promise.all([
    Income.find({ userId: ownerId }).select('amount date').lean(),
    Expense.find({ userId: ownerId }).select('amount date category transactionType').lean(),
  ]);

  const incomeByMonth: Record<string, number> = {};
  const expenseByMonth: Record<string, number> = {};
  const needsByMonth: Record<string, number> = {};
  const wantsByMonth: Record<string, number> = {};
  const categoryByMonth: Record<string, Record<string, number>> = {};

  for (const item of incomes) {
    const key = monthKeyFromDate(item.date);
    incomeByMonth[key] = (incomeByMonth[key] || 0) + item.amount;
  }

  for (const item of expenses) {
    const key = monthKeyFromDate(item.date);
    expenseByMonth[key] = (expenseByMonth[key] || 0) + item.amount;
    if (item.transactionType === 'NEED') {
      needsByMonth[key] = (needsByMonth[key] || 0) + item.amount;
    } else {
      wantsByMonth[key] = (wantsByMonth[key] || 0) + item.amount;
    }
    if (!categoryByMonth[key]) categoryByMonth[key] = {};
    categoryByMonth[key][item.category] = (categoryByMonth[key][item.category] || 0) + item.amount;
  }

  const transactionKeys = [
    ...new Set([...Object.keys(incomeByMonth), ...Object.keys(expenseByMonth)]),
  ].sort();

  let periodKeys: string[];
  let chartKeys: string[];

  if (range === 'all') {
    periodKeys = transactionKeys;
    chartKeys = transactionKeys.length > 0 ? transactionKeys : [anchorKey];
  } else if (range === 'last3') {
    periodKeys = monthKeys(3, anchorKey);
    chartKeys = periodKeys;
  } else if (range === 'last6') {
    periodKeys = monthKeys(6, anchorKey);
    chartKeys = periodKeys;
  } else if (range === 'thisYear') {
    periodKeys = yearMonthKeys(anchorKey.slice(0, 4), anchorKey);
    chartKeys = periodKeys;
  } else {
    periodKeys = [anchorKey];
    chartKeys = monthKeys(chartWindow, anchorKey);
  }

  const monthly: MonthlyPoint[] = chartKeys.map((key) => {
    const income = incomeByMonth[key] || 0;
    const expense = expenseByMonth[key] || 0;
    return {
      month: monthLabel(key),
      monthKey: key,
      income,
      expense,
      savings: income - expense,
    };
  });

  const periodIncome = sumForKeys(incomeByMonth, periodKeys);
  const periodExpense = sumForKeys(expenseByMonth, periodKeys);
  const periodSavings = periodIncome - periodExpense;
  const needsTotal = sumForKeys(needsByMonth, periodKeys);
  const wantsTotal = sumForKeys(wantsByMonth, periodKeys);
  const savingsRate =
    periodIncome === 0 ? 0 : Number(((periodSavings / periodIncome) * 100).toFixed(1));

  const categoryCurrent: Record<string, number> = {};
  for (const key of periodKeys) {
    const bucket = categoryByMonth[key] || {};
    for (const [category, amount] of Object.entries(bucket)) {
      categoryCurrent[category] = (categoryCurrent[category] || 0) + amount;
    }
  }

  const categoryAll: Record<string, number> = {};
  for (const bucket of Object.values(categoryByMonth)) {
    for (const [category, amount] of Object.entries(bucket)) {
      categoryAll[category] = (categoryAll[category] || 0) + amount;
    }
  }

  let incomeChangePercent = 0;
  let expenseChangePercent = 0;

  if (!range && periodKeys.length === 1) {
    const previousKey = shiftMonth(anchorKey, -1);
    incomeChangePercent = percentChange(periodIncome, incomeByMonth[previousKey] || 0);
    expenseChangePercent = percentChange(periodExpense, expenseByMonth[previousKey] || 0);
  } else if (range === 'last3' || range === 'last6') {
    const count = range === 'last3' ? 3 : 6;
    const priorKeys = monthKeys(count, shiftMonth(periodKeys[0], -1));
    const priorIncome = sumForKeys(incomeByMonth, priorKeys);
    const priorExpense = sumForKeys(expenseByMonth, priorKeys);
    incomeChangePercent = percentChange(periodIncome, priorIncome);
    expenseChangePercent = percentChange(periodExpense, priorExpense);
  }

  const toCategoryList = (map: Record<string, number>): CategoryTotal[] =>
    Object.entries(map)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

  const budgetMonth = range ? anchorKey : anchorKey;
  const budgetResult = await listBudgets(userId, { month: budgetMonth });
  const budgetVariance: BudgetVariance[] = budgetResult.budgets.map((budget) => {
    const variance = budget.spent - budget.amount;
    const variancePercent =
      budget.amount === 0 ? (budget.spent > 0 ? 100 : 0) : Number(((variance / budget.amount) * 100).toFixed(1));
    let status: BudgetVariance['status'] = 'on_track';
    if (budget.utilization > 100) status = 'over';
    else if (budget.utilization < 80) status = 'under';

    return {
      id: budget.id,
      category: budget.category || null,
      budgeted: budget.amount,
      actual: budget.spent,
      variance,
      variancePercent,
      utilization: budget.utilization,
      status,
    };
  });

  return {
    currentMonth: {
      key: periodKey(range, anchorKey),
      label: periodLabel(range, anchorKey, periodKeys.length),
      income: periodIncome,
      expense: periodExpense,
      savings: periodSavings,
      savingsRate,
      needsTotal,
      wantsTotal,
      incomeChangePercent,
      expenseChangePercent,
      byCategory: toCategoryList(categoryCurrent),
      range: range || null,
      monthCount: periodKeys.length,
    },
    monthly,
    byCategory: toCategoryList(categoryAll),
    budgetVariance,
  };
}
