import { AppError } from '../../utils/AppError.js';
import { isDatabaseConnected } from '../../config/db.js';
import { Income } from '../income/income.model.js';
import { Expense } from '../expense/expense.model.js';
import { getSummary } from '../summary/summary.service.js';
import {
  buildExpensesCsvTemplate,
  buildImportTemplateBuffer,
  buildIncomeCsvTemplate,
  parseWorkbook,
  ParsedExpenseRow,
  ParsedIncomeRow,
} from './import.utils.js';

const MAX_ROWS = 1000;

function assertDatabase() {
  if (!isDatabaseConnected()) {
    throw new AppError('Database is not connected. Try again in a moment.', 503);
  }
}

function sumAmount<T extends { amount: number }>(rows: T[]) {
  return rows.reduce((total, row) => total + row.amount, 0);
}

function previewPayload(incomes: ParsedIncomeRow[], expenses: ParsedExpenseRow[], errors: { sheet: string; row: number; message: string }[]) {
  const incomeTotal = sumAmount(incomes);
  const expenseTotal = sumAmount(expenses);
  const needsTotal = expenses.filter((item) => item.transactionType === 'NEED').reduce((sum, item) => sum + item.amount, 0);
  const wantsTotal = expenses.filter((item) => item.transactionType === 'WANT').reduce((sum, item) => sum + item.amount, 0);

  return {
    incomeCount: incomes.length,
    expenseCount: expenses.length,
    incomeTotal,
    expenseTotal,
    netFromFile: incomeTotal - expenseTotal,
    needsTotal,
    wantsTotal,
    incomes: incomes.slice(0, 5),
    expenses: expenses.slice(0, 5),
    errors,
    errorCount: errors.length,
    ready: incomes.length + expenses.length > 0 && errors.length === 0,
  };
}

export function buildTemplate() {
  return buildImportTemplateBuffer();
}

export function buildIncomeCsv() {
  return Buffer.from(buildIncomeCsvTemplate(), 'utf-8');
}

export function buildExpensesCsv() {
  return Buffer.from(buildExpensesCsvTemplate(), 'utf-8');
}

export function previewImport(buffer: Buffer) {
  const parsed = parseWorkbook(buffer);
  if (parsed.incomes.length + parsed.expenses.length > MAX_ROWS * 2) {
    throw new AppError(`Import is limited to ${MAX_ROWS} rows per sheet.`, 400);
  }
  return previewPayload(parsed.incomes, parsed.expenses, parsed.errors);
}

export async function commitImport(userId: string, buffer: Buffer) {
  assertDatabase();
  const parsed = parseWorkbook(buffer);
  if (parsed.incomes.length + parsed.expenses.length === 0) {
    throw new AppError('No valid income or expense rows were found in the file.', 400);
  }
  if (parsed.errors.length > 0) {
    throw new AppError('Fix the highlighted row errors before importing.', 400);
  }
  if (parsed.incomes.length + parsed.expenses.length > MAX_ROWS * 2) {
    throw new AppError(`Import is limited to ${MAX_ROWS} rows per sheet.`, 400);
  }

  if (parsed.incomes.length > 0) {
    await Income.insertMany(
      parsed.incomes.map((row) => ({
        userId,
        amount: row.amount,
        source: row.source,
        date: new Date(`${row.date}T00:00:00.000Z`),
        incomeType: row.incomeType,
        description: row.description,
        recurring: row.recurring,
      }))
    );
  }

  if (parsed.expenses.length > 0) {
    await Expense.insertMany(
      parsed.expenses.map((row) => ({
        userId,
        amount: row.amount,
        description: row.description,
        category: row.category,
        subcategory: row.subcategory,
        date: new Date(`${row.date}T00:00:00.000Z`),
        paymentMethod: row.paymentMethod,
        transactionType: row.transactionType,
        recurring: row.recurring,
      }))
    );
  }

  const summary = await getSummary(userId, { months: 6 });
  const fileTotals = previewPayload(parsed.incomes, parsed.expenses, []);

  return {
    imported: {
      incomeCount: parsed.incomes.length,
      expenseCount: parsed.expenses.length,
      incomeTotal: fileTotals.incomeTotal,
      expenseTotal: fileTotals.expenseTotal,
      netFromFile: fileTotals.netFromFile,
    },
    currentMonth: summary.currentMonth,
    monthly: summary.monthly,
  };
}
