import mongoose from 'mongoose';
import { getSummary } from '../summary/summary.service.js';
import { listBudgets, PublicBudget } from '../budget/budget.service.js';
import { listGoals } from '../goal/goal.service.js';
import { getProfile } from '../profile/profile.service.js';
import { getHealthScore, PublicHealthScore } from '../score/score.service.js';
import { getLatestPrediction, PublicPrediction } from '../prediction/prediction.service.js';
import { listIncomes } from '../income/income.service.js';
import { listExpenses } from '../expense/expense.service.js';
import { Income } from '../income/income.model.js';
import { Expense } from '../expense/expense.model.js';
import { AppError } from '../../utils/AppError.js';
import { isDatabaseConnected } from '../../config/db.js';

export type ReportMonthOption = {
  key: string;
  label: string;
  income: number;
  expense: number;
  savings: number;
};

export type ReportIncomeRow = {
  id: string;
  date: string;
  source: string;
  incomeType: string;
  amount: number;
  description?: string;
};

export type ReportExpenseRow = {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  transactionType: string;
};

export type PublicReport = {
  preparedFor: string;
  period: { key: string; label: string };
  currentMonth: {
    income: number;
    expense: number;
    savings: number;
    savingsRate: number;
    byCategory: { category: string; amount: number }[];
  };
  incomes: ReportIncomeRow[];
  expenses: ReportExpenseRow[];
  prediction: PublicPrediction | null;
  health: PublicHealthScore | null;
  budgets: PublicBudget[];
  goals: {
    name: string;
    remaining: number;
    requiredMonthly: number;
    status: string;
  }[];
  executiveSummary: string;
};

export { buildPdfBuffer } from './report.pdf.js';

function assertDatabase() {
  if (!isDatabaseConnected()) {
    throw new AppError('Database is not connected. Try again in a moment.', 503);
  }
}

function formatRs(amount: number) {
  return `Rs. ${Math.round(amount).toLocaleString('en-US')}`;
}

function monthKeyFromDate(value: Date) {
  return value.toISOString().slice(0, 7);
}

function monthLabel(monthKey: string) {
  const date = new Date(`${monthKey}-01T00:00:00.000Z`);
  return date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
}

function monthRange(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return {
    from: start.toISOString().slice(0, 10),
    to: new Date(end.getTime() - 86400000).toISOString().slice(0, 10),
  };
}

function resolveMonthKey(month?: string) {
  const current = monthKeyFromDate(new Date());
  if (!month) return current;
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new AppError('Use a valid month (YYYY-MM).', 400);
  }
  const monthNum = Number(month.slice(5, 7));
  if (monthNum < 1 || monthNum > 12) {
    throw new AppError('Use a valid month (YYYY-MM).', 400);
  }
  return month;
}

export async function listReportMonths(userId: string): Promise<ReportMonthOption[]> {
  assertDatabase();
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError('User not found.', 404);
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const [incomeMonths, expenseMonths] = await Promise.all([
    Income.aggregate<{ _id: string; total: number }>([
      { $match: { userId: userObjectId } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$date', timezone: 'UTC' } },
          total: { $sum: '$amount' },
        },
      },
    ]),
    Expense.aggregate<{ _id: string; total: number }>([
      { $match: { userId: userObjectId } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$date', timezone: 'UTC' } },
          total: { $sum: '$amount' },
        },
      },
    ]),
  ]);

  const map = new Map<string, { income: number; expense: number }>();
  for (const row of incomeMonths) {
    map.set(row._id, { income: row.total, expense: 0 });
  }
  for (const row of expenseMonths) {
    const existing = map.get(row._id) || { income: 0, expense: 0 };
    existing.expense = row.total;
    map.set(row._id, existing);
  }

  const currentKey = monthKeyFromDate(new Date());
  if (!map.has(currentKey)) {
    map.set(currentKey, { income: 0, expense: 0 });
  }

  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, totals]) => ({
      key,
      label: monthLabel(key),
      income: Math.round(totals.income),
      expense: Math.round(totals.expense),
      savings: Math.round(totals.income - totals.expense),
    }));
}

function buildExecutiveSummary(report: Omit<PublicReport, 'executiveSummary'>): string {
  const parts: string[] = [];
  const { currentMonth, budgets, health, goals, period } = report;
  parts.push(
    `In ${period.label}, income was ${formatRs(currentMonth.income)}, expenses ${formatRs(currentMonth.expense)}, and net savings ${formatRs(currentMonth.savings)} (${currentMonth.savingsRate}%).`
  );

  const over = budgets.filter((item) => item.utilization > 100);
  if (over.length > 0) {
    parts.push(
      `Over-budget: ${over
        .map((item) => `${item.category || 'Overall'} at ${item.utilization}%`)
        .join(', ')}.`
    );
  } else if (budgets.length > 0) {
    parts.push('All recorded budgets for this month are within 100% utilization.');
  }

  if (health) {
    parts.push(`Health score is ${health.overallScore}/100 (${health.status}).`);
    if (health.recommendations[0]) parts.push(health.recommendations[0]);
  }

  const activeGoal = goals.find((item) => item.status === 'ACTIVE');
  if (activeGoal) {
    parts.push(
      `Active goal "${activeGoal.name}" still needs ${formatRs(activeGoal.remaining)} (${formatRs(activeGoal.requiredMonthly)} / month).`
    );
  }

  return parts.join(' ');
}

export async function buildReport(userId: string, month?: string): Promise<PublicReport> {
  assertDatabase();
  const monthKey = resolveMonthKey(month);
  const range = monthRange(monthKey);
  const isCurrentMonth = monthKey === monthKeyFromDate(new Date());

  const [profile, summary, budgetResult, goalResult, prediction, health, incomeResult, expenseResult] =
    await Promise.all([
      getProfile(userId),
      getSummary(userId, { months: 1, month: monthKey }),
      listBudgets(userId, { month: monthKey }),
      listGoals(userId),
      isCurrentMonth ? getLatestPrediction(userId) : Promise.resolve(null),
      isCurrentMonth ? getHealthScore(userId) : Promise.resolve(null),
      listIncomes(userId, { from: range.from, to: range.to }),
      listExpenses(userId, { from: range.from, to: range.to }),
    ]);

  const draft = {
    preparedFor: profile.name,
    period: { key: monthKey, label: summary.currentMonth.label },
    currentMonth: {
      income: summary.currentMonth.income,
      expense: summary.currentMonth.expense,
      savings: summary.currentMonth.savings,
      savingsRate: summary.currentMonth.savingsRate,
      byCategory: summary.currentMonth.byCategory,
    },
    incomes: incomeResult.incomes.map((row) => ({
      id: row.id,
      date: row.date,
      source: row.source,
      incomeType: row.incomeType,
      amount: row.amount,
      description: row.description,
    })),
    expenses: expenseResult.expenses.map((row) => ({
      id: row.id,
      date: row.date,
      category: row.category,
      description: row.description,
      amount: row.amount,
      paymentMethod: row.paymentMethod,
      transactionType: row.transactionType,
    })),
    prediction,
    health,
    budgets: budgetResult.budgets,
    goals: goalResult.goals.map((goal) => ({
      name: goal.name,
      remaining: goal.remaining,
      requiredMonthly: goal.requiredMonthly,
      status: goal.status,
    })),
  };

  return {
    ...draft,
    executiveSummary: buildExecutiveSummary(draft),
  };
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function excelRow(cells: { type: 'String' | 'Number'; value: string | number }[]) {
  const inner = cells
    .map((cell) => {
      if (cell.type === 'Number') {
        return `<Cell><Data ss:Type="Number">${cell.value}</Data></Cell>`;
      }
      return `<Cell><Data ss:Type="String">${xmlEscape(String(cell.value))}</Data></Cell>`;
    })
    .join('');
  return `<Row>${inner}</Row>`;
}

export function buildExcelBuffer(report: PublicReport): Buffer {
  const year = report.period.key.slice(0, 4);
  const rows: string[] = [
    excelRow([{ type: 'String', value: 'SmartFin AI Monthly Statement' }]),
    excelRow([
      { type: 'String', value: 'Prepared for' },
      { type: 'String', value: report.preparedFor },
    ]),
    excelRow([
      { type: 'String', value: 'Period' },
      { type: 'String', value: `${report.period.label} ${year}` },
    ]),
    excelRow([]),
    excelRow([
      { type: 'String', value: 'Income' },
      { type: 'Number', value: report.currentMonth.income },
    ]),
    excelRow([
      { type: 'String', value: 'Expenses' },
      { type: 'Number', value: report.currentMonth.expense },
    ]),
    excelRow([
      { type: 'String', value: 'Savings' },
      { type: 'Number', value: report.currentMonth.savings },
    ]),
    excelRow([
      { type: 'String', value: 'Savings rate %' },
      { type: 'Number', value: report.currentMonth.savingsRate },
    ]),
    excelRow([]),
    excelRow([{ type: 'String', value: 'Category' }, { type: 'String', value: 'Amount' }]),
  ];

  if (report.currentMonth.byCategory.length === 0) {
    rows.push(excelRow([{ type: 'String', value: 'No expenses recorded this month.' }]));
  } else {
    for (const row of report.currentMonth.byCategory) {
      rows.push(
        excelRow([
          { type: 'String', value: row.category },
          { type: 'Number', value: row.amount },
        ])
      );
    }
  }

  rows.push(excelRow([]));
  rows.push(
    excelRow([
      { type: 'String', value: 'Budget' },
      { type: 'String', value: 'Spent' },
      { type: 'String', value: 'Limit' },
      { type: 'String', value: 'Utilization %' },
    ])
  );
  if (report.budgets.length === 0) {
    rows.push(excelRow([{ type: 'String', value: 'No budgets set for this month.' }]));
  } else {
    for (const budget of report.budgets) {
      rows.push(
        excelRow([
          { type: 'String', value: budget.category || 'Overall' },
          { type: 'Number', value: budget.spent },
          { type: 'Number', value: budget.amount },
          { type: 'Number', value: budget.utilization },
        ])
      );
    }
  }

  rows.push(excelRow([]));
  if (report.prediction) {
    rows.push(
      excelRow([
        { type: 'String', value: 'Forecast period' },
        { type: 'String', value: report.prediction.predictionPeriod },
      ])
    );
    rows.push(
      excelRow([
        { type: 'String', value: 'Forecast amount' },
        { type: 'Number', value: report.prediction.predictedAmount },
      ])
    );
    rows.push(
      excelRow([
        { type: 'String', value: 'Model' },
        { type: 'String', value: report.prediction.modelUsed },
      ])
    );
  } else {
    rows.push(excelRow([{ type: 'String', value: 'No stored forecast.' }]));
  }

  if (report.health) {
    rows.push(
      excelRow([
        { type: 'String', value: 'Health score' },
        { type: 'Number', value: report.health.overallScore },
      ])
    );
    rows.push(
      excelRow([
        { type: 'String', value: 'Health status' },
        { type: 'String', value: report.health.status },
      ])
    );
  }

  rows.push(excelRow([]));
  rows.push(
    excelRow([
      { type: 'String', value: 'Date' },
      { type: 'String', value: 'Source' },
      { type: 'String', value: 'Type' },
      { type: 'String', value: 'Amount' },
      { type: 'String', value: 'Description' },
    ])
  );
  if (report.incomes.length === 0) {
    rows.push(excelRow([{ type: 'String', value: 'No income records for this month.' }]));
  } else {
    for (const row of report.incomes) {
      rows.push(
        excelRow([
          { type: 'String', value: row.date },
          { type: 'String', value: row.source },
          { type: 'String', value: row.incomeType },
          { type: 'Number', value: row.amount },
          { type: 'String', value: row.description || '' },
        ])
      );
    }
  }

  rows.push(excelRow([]));
  rows.push(
    excelRow([
      { type: 'String', value: 'Date' },
      { type: 'String', value: 'Category' },
      { type: 'String', value: 'Description' },
      { type: 'String', value: 'Payment' },
      { type: 'String', value: 'Need/Want' },
      { type: 'String', value: 'Amount' },
    ])
  );
  if (report.expenses.length === 0) {
    rows.push(excelRow([{ type: 'String', value: 'No expense records for this month.' }]));
  } else {
    for (const row of report.expenses) {
      rows.push(
        excelRow([
          { type: 'String', value: row.date },
          { type: 'String', value: row.category },
          { type: 'String', value: row.description },
          { type: 'String', value: row.paymentMethod },
          { type: 'String', value: row.transactionType },
          { type: 'Number', value: row.amount },
        ])
      );
    }
  }

  rows.push(excelRow([]));
  rows.push(
    excelRow([
      { type: 'String', value: 'Executive summary' },
      { type: 'String', value: report.executiveSummary },
    ])
  );

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Statement">
  <Table>
   ${rows.join('\n   ')}
  </Table>
 </Worksheet>
</Workbook>`;

  return Buffer.from(xml, 'utf8');
}

export function exportFilename(report: PublicReport, extension: 'pdf' | 'xls') {
  return `smartfin-statement-${report.period.key}.${extension}`;
}
