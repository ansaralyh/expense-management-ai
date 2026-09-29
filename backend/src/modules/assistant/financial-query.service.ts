import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import { isDatabaseConnected } from '../../config/db.js';
import { Income } from '../income/income.model.js';
import { Expense, EXPENSE_CATEGORIES } from '../expense/expense.model.js';
import { getSummary } from '../summary/summary.service.js';
import { listBudgets } from '../budget/budget.service.js';
import { DateRange, buildMonthRange, monthLabel } from './date-parser.js';

function assertDatabase() {
  if (!isDatabaseConnected()) {
    throw new AppError('Database is not connected. Try again in a moment.', 503);
  }
}

function assertUserId(userId: string) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError('User not found.', 404);
  }
}

export type MonthTotals = {
  monthKey: string;
  label: string;
  income: number;
  expense: number;
  savings: number;
  savingsRate: number;
  needsTotal: number;
  wantsTotal: number;
  byCategory: { category: string; amount: number }[];
};

export type SalaryResult = {
  total: number;
  count: number;
  label: string;
};

export type LargestExpenseResult = {
  amount: number;
  category: string;
  description: string;
  date: string;
  label: string;
} | null;

function toMonthTotals(monthKey: string, summary: Awaited<ReturnType<typeof getSummary>>): MonthTotals {
  const m = summary.currentMonth;
  return {
    monthKey,
    label: monthLabel(monthKey),
    income: m.income,
    expense: m.expense,
    savings: m.savings,
    savingsRate: m.savingsRate,
    needsTotal: m.needsTotal,
    wantsTotal: m.wantsTotal,
    byCategory: m.byCategory,
  };
}

export async function getMonthTotals(userId: string, monthKey: string): Promise<MonthTotals> {
  assertDatabase();
  assertUserId(userId);
  const summary = await getSummary(userId, { months: 1, month: monthKey });
  return toMonthTotals(monthKey, summary);
}

export async function getTotalIncome(userId: string, range: DateRange): Promise<number> {
  assertDatabase();
  assertUserId(userId);
  const rows = await Income.find({
    userId,
    date: { $gte: range.start, $lt: range.end },
  })
    .select('amount')
    .lean();
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

export async function getTotalExpenses(userId: string, range: DateRange): Promise<number> {
  assertDatabase();
  assertUserId(userId);
  const rows = await Expense.find({
    userId,
    date: { $gte: range.start, $lt: range.end },
  })
    .select('amount')
    .lean();
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

export async function getNetSavings(userId: string, range: DateRange): Promise<{ savings: number; income: number; expense: number }> {
  const [income, expense] = await Promise.all([
    getTotalIncome(userId, range),
    getTotalExpenses(userId, range),
  ]);
  return { income, expense, savings: income - expense };
}

export async function getCategoryExpenses(
  userId: string,
  category: string,
  range: DateRange
): Promise<number> {
  assertDatabase();
  assertUserId(userId);
  const rows = await Expense.find({
    userId,
    category,
    date: { $gte: range.start, $lt: range.end },
  })
    .select('amount')
    .lean();
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

export async function getTopExpenseCategories(
  userId: string,
  range: DateRange,
  limit = 5
): Promise<{ category: string; amount: number }[]> {
  const totals = await getMonthTotals(userId, range.monthKey);
  return totals.byCategory.slice(0, limit);
}

export async function getLargestExpense(userId: string, range: DateRange): Promise<LargestExpenseResult> {
  assertDatabase();
  assertUserId(userId);
  const row = await Expense.findOne({
    userId,
    date: { $gte: range.start, $lt: range.end },
  })
    .sort({ amount: -1 })
    .select('amount category description date')
    .lean();

  if (!row) return null;

  return {
    amount: row.amount,
    category: row.category,
    description: row.description,
    date: row.date.toISOString().slice(0, 10),
    label: range.label,
  };
}

export async function getSalaryIncome(userId: string, range: DateRange): Promise<SalaryResult> {
  assertDatabase();
  assertUserId(userId);
  const rows = await Income.find({
    userId,
    incomeType: 'Salary',
    date: { $gte: range.start, $lt: range.end },
  })
    .select('amount')
    .lean();

  return {
    total: rows.reduce((sum, row) => sum + row.amount, 0),
    count: rows.length,
    label: range.label,
  };
}

export async function getSalaryTransactionCount(userId: string, range: DateRange): Promise<number> {
  assertDatabase();
  assertUserId(userId);
  return Income.countDocuments({
    userId,
    incomeType: 'Salary',
    date: { $gte: range.start, $lt: range.end },
  });
}

export async function getIncomeTransactionCount(userId: string, range: DateRange): Promise<number> {
  assertDatabase();
  assertUserId(userId);
  return Income.countDocuments({
    userId,
    date: { $gte: range.start, $lt: range.end },
  });
}

export async function getExpenseTransactionCount(userId: string, range: DateRange): Promise<number> {
  assertDatabase();
  assertUserId(userId);
  return Expense.countDocuments({
    userId,
    date: { $gte: range.start, $lt: range.end },
  });
}

export async function compareMonths(
  userId: string,
  monthKeyA: string,
  monthKeyB: string
): Promise<{ a: MonthTotals; b: MonthTotals; expenseDelta: number; incomeDelta: number }> {
  const [a, b] = await Promise.all([
    getMonthTotals(userId, monthKeyA),
    getMonthTotals(userId, monthKeyB),
  ]);
  return {
    a,
    b,
    expenseDelta: b.expense - a.expense,
    incomeDelta: b.income - a.income,
  };
}

export async function getBudgetStatus(userId: string, monthKey: string) {
  assertDatabase();
  assertUserId(userId);
  const result = await listBudgets(userId, { month: monthKey });
  return result.budgets;
}

export function matchedCategory(question: string): string | undefined {
  const q = question.toLowerCase();
  return EXPENSE_CATEGORIES.find((category) => q.includes(category.toLowerCase()));
}

export { buildMonthRange, EXPENSE_CATEGORIES };
