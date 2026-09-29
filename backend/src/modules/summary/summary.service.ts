import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import { isDatabaseConnected } from '../../config/db.js';
import { Income } from '../income/income.model.js';
import { Expense } from '../expense/expense.model.js';
import { listBudgets } from '../budget/budget.service.js';

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

function assertDatabase() {
  if (!isDatabaseConnected()) {
    throw new AppError('Database is not connected. Try again in a moment.', 503);
  }
}

function monthKeyFromDate(value: Date) {
  return value.toISOString().slice(0, 7);
}

function monthLabel(monthKey: string) {
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

function startOfMonth(monthKey: string) {
  return new Date(`${monthKey}-01T00:00:00.000Z`);
}

function startOfNextMonth(monthKey: string) {
  return startOfMonth(shiftMonth(monthKey, 1));
}

function percentChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export async function getSummary(userId: string, months = 6, month?: string) {
  assertDatabase();

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError('User not found.', 404);
  }

  const currentKey = month || monthKeyFromDate(new Date());
  const keys = monthKeys(months, currentKey);
  const rangeStart = startOfMonth(keys[0]);
  const rangeEnd = startOfNextMonth(currentKey);
  const ownerId = new mongoose.Types.ObjectId(userId);

  const [incomes, expenses] = await Promise.all([
    Income.find({ userId: ownerId, date: { $gte: rangeStart, $lt: rangeEnd } }).select('amount date').lean(),
    Expense.find({ userId: ownerId, date: { $gte: rangeStart, $lt: rangeEnd } })
      .select('amount date category transactionType')
      .lean(),
  ]);

  const incomeByMonth: Record<string, number> = {};
  const expenseByMonth: Record<string, number> = {};
  const needsByMonth: Record<string, number> = {};
  const wantsByMonth: Record<string, number> = {};
  const categoryAll: Record<string, number> = {};
  const categoryCurrent: Record<string, number> = {};

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
    categoryAll[item.category] = (categoryAll[item.category] || 0) + item.amount;
    if (key === currentKey) {
      categoryCurrent[item.category] = (categoryCurrent[item.category] || 0) + item.amount;
    }
  }

  const monthly: MonthlyPoint[] = keys.map((key) => {
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

  const previousKey = shiftMonth(currentKey, -1);
  const currentIncome = incomeByMonth[currentKey] || 0;
  const currentExpense = expenseByMonth[currentKey] || 0;
  const previousIncome = incomeByMonth[previousKey] || 0;
  const previousExpense = expenseByMonth[previousKey] || 0;
  const currentSavings = currentIncome - currentExpense;
  const needsTotal = needsByMonth[currentKey] || 0;
  const wantsTotal = wantsByMonth[currentKey] || 0;
  const savingsRate = currentIncome === 0 ? 0 : Number(((currentSavings / currentIncome) * 100).toFixed(1));

  const toCategoryList = (map: Record<string, number>): CategoryTotal[] =>
    Object.entries(map)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

  const budgetResult = await listBudgets(userId, { month: currentKey });
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
      key: currentKey,
      label: monthLabel(currentKey),
      income: currentIncome,
      expense: currentExpense,
      savings: currentSavings,
      savingsRate,
      needsTotal,
      wantsTotal,
      incomeChangePercent: percentChange(currentIncome, previousIncome),
      expenseChangePercent: percentChange(currentExpense, previousExpense),
      byCategory: toCategoryList(categoryCurrent),
    },
    monthly,
    byCategory: toCategoryList(categoryAll),
    budgetVariance,
  };
}
