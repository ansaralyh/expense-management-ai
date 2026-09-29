import { listBudgets } from '../budget/budget.service.js';
import { listDebts } from '../debt/debt.service.js';
import { listGoals } from '../goal/goal.service.js';
import { getNetWorthSummary } from '../networth/networth.service.js';
import { listRecurringTemplates } from '../recurring/recurring.service.js';
import { getEmergencyFundPlan } from '../score/score.service.js';
import { getSummary } from '../summary/summary.service.js';
import { runSimulation } from '../simulator/simulator.service.js';
import { StructuredAIResponse } from './ai-provider.js';
import { formatRs } from './response-builder.js';

export type WhatIfScenario =
  | { kind: 'afford'; amount: number; label?: string }
  | { kind: 'one_time_spend'; amount: number }
  | { kind: 'income_change_percent'; percent: number }
  | { kind: 'expense_reduce'; amount: number }
  | { kind: 'monthly_save'; amount: number };

export function extractAmountFromQuestion(question: string): number | undefined {
  const rsMatch = question.match(/rs\.?\s*([\d,]+(?:\.\d+)?)/i);
  if (rsMatch) return parseFloat(rsMatch[1].replace(/,/g, ''));

  const labeled = question.match(/\b(?:for|of|by|save|spend|reduce|afford)\s+([\d,]+(?:\.\d+)?)/i);
  if (labeled) return parseFloat(labeled[1].replace(/,/g, ''));

  const commaNumber = question.match(/\b([\d]{1,3}(?:,\d{3})+(?:\.\d+)?)\b/);
  if (commaNumber) return parseFloat(commaNumber[1].replace(/,/g, ''));

  const plain = question.match(/\b(\d{4,}(?:\.\d+)?)\b/);
  if (plain) return parseFloat(plain[1]);

  return undefined;
}

export function extractPercentFromQuestion(question: string): number | undefined {
  const match = question.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? parseFloat(match[1]) : undefined;
}

export function extractAffordLabel(question: string): string | undefined {
  const match = question.match(/\bafford(?:\s+to\s+buy)?\s+(?:a|an|the)?\s*([a-z][a-z0-9\s-]{2,40}?)(?:\s+for|\s+at|\?|$)/i);
  if (!match) return undefined;
  return match[1].trim();
}

export function parseWhatIfScenario(question: string): WhatIfScenario | null {
  const q = question.toLowerCase().replace(/\s+/g, ' ').trim();

  if (/\b(can i afford|could i afford|afford to buy|afford a|afford an)\b/.test(q)) {
    const amount = extractAmountFromQuestion(question);
    if (!amount || amount <= 0) return null;
    return { kind: 'afford', amount, label: extractAffordLabel(question) };
  }

  const isWhatIf =
    /\b(what if|what happens if|what would happen if|suppose|if my|if i)\b/.test(q) ||
    /\bwhat happens when\b/.test(q);

  if (!isWhatIf) return null;

  const percent = extractPercentFromQuestion(question);
  if (
    percent !== undefined &&
    /\b(income|salary|earn|earning|paid|pay)\b/.test(q) &&
    /\b(increases?|rises?|went up|go up|goes up|grows?|higher|boost(?:ed|s)?)\b/.test(q)
  ) {
    return { kind: 'income_change_percent', percent };
  }

  if (
    percent !== undefined &&
    /\b(expenses?|spending|spend)\b/.test(q) &&
    /\b(reduce[sd]?|cut|cuts?|lower(?:ed|s)?|decrease[sd]?)\b/.test(q)
  ) {
    const amount = extractAmountFromQuestion(question);
    if (amount) return { kind: 'expense_reduce', amount };
  }

  const amount = extractAmountFromQuestion(question);
  if (!amount || amount <= 0) return null;

  if (/\b(every month|each month|per month|monthly)\b/.test(q) && /\b(save|saving|put aside|set aside)\b/.test(q)) {
    return { kind: 'monthly_save', amount };
  }

  if (/\b(reduce[sd]?|cut|cuts?|lower(?:ed|s)?|decrease[sd]?).*\b(expenses?|spending|spend)\b/.test(q)) {
    return { kind: 'expense_reduce', amount };
  }

  if (/\b(spend|spending|spend on|pay|purchase|buy)\b/.test(q)) {
    return { kind: 'one_time_spend', amount };
  }

  if (/\b(save|saving)\b/.test(q)) {
    return { kind: 'monthly_save', amount };
  }

  if (percent !== undefined && /\b(income|salary|earn|earning|paid|pay)\b/.test(q)) {
    return { kind: 'income_change_percent', percent };
  }

  return { kind: 'one_time_spend', amount };
}

type AffordabilitySnapshot = {
  monthLabel: string;
  currentIncome: number;
  currentExpense: number;
  currentSavings: number;
  savingsRate: number;
  avgMonthlyExpense: number;
  avgMonthlyIncome: number;
  liquidAssets: number;
  netWorth: number;
  recurringIncomeMonthly: number;
  recurringExpenseMonthly: number;
  debtEmiMonthly: number;
  debtRemaining: number;
  goalRequiredMonthly: number;
  emergencyFundBalance: number;
  emergencyFundTarget: number;
  budgetRemainingTotal: number;
  monthlySurplusAfterCommitments: number;
};

async function loadSnapshot(userId: string): Promise<AffordabilitySnapshot> {
  const [summary, recurring, debts, goals, netWorth, emergency, budgetResult] = await Promise.all([
    getSummary(userId, { months: 6 }),
    listRecurringTemplates(userId),
    listDebts(userId),
    listGoals(userId),
    getNetWorthSummary(userId),
    getEmergencyFundPlan(userId),
    listBudgets(userId, {}),
  ]);

  const month = summary.currentMonth;
  const monthly = summary.monthly;
  const avgMonthlyExpense =
    monthly.length === 0 ? month.expense : monthly.reduce((s, m) => s + m.expense, 0) / monthly.length;
  const avgMonthlyIncome =
    monthly.length === 0 ? month.income : monthly.reduce((s, m) => s + m.income, 0) / monthly.length;

  const liquidCategories = new Set(['Cash', 'Savings', 'Gold']);
  const liquidAssets = netWorth.assets
    .filter((a) => liquidCategories.has(a.category))
    .reduce((s, a) => s + a.value, 0);

  const recurringIncomeMonthly = recurring.income.reduce((s, t) => s + t.amount, 0);
  const recurringExpenseMonthly = recurring.expense.reduce((s, t) => s + t.amount, 0);
  const goalRequiredMonthly = goals.goals
    .filter((g) => g.status === 'ACTIVE')
    .reduce((s, g) => s + g.requiredMonthly, 0);
  const budgetRemainingTotal = budgetResult.budgets.reduce((s, b) => s + Math.max(0, b.remaining), 0);

  const monthlySurplusAfterCommitments =
    month.income - month.expense - debts.totalMonthlyEmi - goalRequiredMonthly;

  return {
    monthLabel: month.label,
    currentIncome: month.income,
    currentExpense: month.expense,
    currentSavings: month.savings,
    savingsRate: month.savingsRate,
    avgMonthlyExpense: Math.round(avgMonthlyExpense),
    avgMonthlyIncome: Math.round(avgMonthlyIncome),
    liquidAssets: Math.round(liquidAssets),
    netWorth: netWorth.netWorth,
    recurringIncomeMonthly: Math.round(recurringIncomeMonthly),
    recurringExpenseMonthly: Math.round(recurringExpenseMonthly),
    debtEmiMonthly: Math.round(debts.totalMonthlyEmi),
    debtRemaining: Math.round(debts.totalRemaining),
    goalRequiredMonthly: Math.round(goalRequiredMonthly),
    emergencyFundBalance: emergency.currentBalance,
    emergencyFundTarget: emergency.targetAmount,
    budgetRemainingTotal: Math.round(budgetRemainingTotal),
    monthlySurplusAfterCommitments: Math.round(monthlySurplusAfterCommitments),
  };
}

function snapshotLines(snapshot: AffordabilitySnapshot): string[] {
  return [
    `Current month (${snapshot.monthLabel}): Income ${formatRs(snapshot.currentIncome)}, Expenses ${formatRs(snapshot.currentExpense)}, Net savings ${formatRs(snapshot.currentSavings)} (${snapshot.savingsRate}%)`,
    `6-month averages: Income ${formatRs(snapshot.avgMonthlyIncome)}, Expenses ${formatRs(snapshot.avgMonthlyExpense)}`,
    `Liquid assets (Cash/Savings/Gold): ${formatRs(snapshot.liquidAssets)} | Net worth: ${formatRs(snapshot.netWorth)}`,
    `Recurring commitments: ${formatRs(snapshot.recurringExpenseMonthly)}/month expenses, ${formatRs(snapshot.recurringIncomeMonthly)}/month income`,
    `Debt: ${formatRs(snapshot.debtEmiMonthly)}/month EMI, ${formatRs(snapshot.debtRemaining)} remaining`,
    `Savings goals require: ${formatRs(snapshot.goalRequiredMonthly)}/month | Budget headroom: ${formatRs(snapshot.budgetRemainingTotal)}`,
    `Emergency fund: ${formatRs(snapshot.emergencyFundBalance)} of ${formatRs(snapshot.emergencyFundTarget)} target`,
    `Surplus after expenses, EMIs, and goal contributions: ${formatRs(snapshot.monthlySurplusAfterCommitments)}/month`,
  ];
}

function formatAfford(snapshot: AffordabilitySnapshot, amount: number, label?: string) {
  const item = label || 'this purchase';
  const afterLiquid = snapshot.liquidAssets - amount;
  const afterMonthSavings = snapshot.currentSavings - amount;
  const monthsToSave =
    snapshot.monthlySurplusAfterCommitments > 0
      ? Math.ceil(amount / snapshot.monthlySurplusAfterCommitments)
      : null;

  const lines = [
    `Based on the financial information currently recorded in SmartFin, here is an affordability view for ${item} at ${formatRs(amount)}:`,
    '',
    ...snapshotLines(snapshot),
    '',
    `Purchase impact:`,
    `• Paying from liquid assets would leave ${formatRs(Math.max(0, afterLiquid))} (${afterLiquid < 0 ? 'shortfall of ' + formatRs(Math.abs(afterLiquid)) : 'remaining'})`,
    `• As a one-time hit to this month's savings, net savings would become ${formatRs(afterMonthSavings)}`,
  ];

  if (monthsToSave !== null) {
    lines.push(`• Saving from monthly surplus would take about ${monthsToSave} month(s) at ${formatRs(snapshot.monthlySurplusAfterCommitments)}/month`);
  } else {
    lines.push(`• Monthly surplus after commitments is ${formatRs(snapshot.monthlySurplusAfterCommitments)}, so saving toward this purchase would require cutting expenses or increasing income`);
  }

  if (afterLiquid >= amount) {
    lines.push(`• Liquid assets cover the full ${formatRs(amount)} without borrowing`);
  } else if (afterLiquid + snapshot.currentSavings >= amount) {
    lines.push(`• Liquid assets plus this month's savings could cover ${formatRs(afterLiquid + snapshot.currentSavings)} — still below the full price`);
  } else {
    lines.push(`• Recorded liquid assets and this month's savings together do not fully cover ${formatRs(amount)}`);
  }

  if (snapshot.emergencyFundBalance > 0 && afterLiquid < snapshot.emergencyFundTarget * 0.5) {
    lines.push(`• Warning: paying from liquid assets could reduce reserves well below your emergency fund target of ${formatRs(snapshot.emergencyFundTarget)}`);
  }

  return lines.join('\n');
}

function formatOneTimeSpend(snapshot: AffordabilitySnapshot, amount: number) {
  const projectedSavings = snapshot.currentSavings - amount;
  const projectedSavingsRate =
    snapshot.currentIncome === 0
      ? 0
      : Number(((projectedSavings / snapshot.currentIncome) * 100).toFixed(1));

  return [
    `Based on the financial information currently recorded in SmartFin, a one-time spend of ${formatRs(amount)} would affect ${snapshot.monthLabel} like this:`,
    '',
    ...snapshotLines(snapshot),
    '',
    `Scenario:`,
    `• Current net savings: ${formatRs(snapshot.currentSavings)} → ${formatRs(projectedSavings)}`,
    `• Savings rate: ${snapshot.savingsRate}% → ${projectedSavingsRate}%`,
    `• Liquid assets after purchase (if paid from reserves): ${formatRs(snapshot.liquidAssets - amount)}`,
    projectedSavings < 0
      ? `• This would put the month ${formatRs(Math.abs(projectedSavings))} below break-even based on recorded income and existing expenses`
      : `• You would still show positive net savings this month after the spend`,
  ].join('\n');
}

async function formatIncomeChange(userId: string, snapshot: AffordabilitySnapshot, percent: number) {
  const simulation = await runSimulation(userId, { incomeChangePercent: percent });
  return [
    `Based on the financial information currently recorded in SmartFin, a ${percent >= 0 ? '+' : ''}${percent}% change to income projects the following for ${simulation.monthLabel}:`,
    '',
    ...snapshotLines(snapshot),
    '',
    `Simulator results (reusing the What-If engine):`,
    `• Income: ${formatRs(simulation.current.income)} → ${formatRs(simulation.projected.income)}`,
    `• Expenses: ${formatRs(simulation.current.expense)} (unchanged in this scenario)`,
    `• Net savings: ${formatRs(simulation.current.savings)} → ${formatRs(simulation.projected.savings)} (${simulation.delta.savings >= 0 ? '+' : ''}${formatRs(simulation.delta.savings)})`,
    `• Savings rate: ${simulation.current.savingsRate}% → ${simulation.projected.savingsRate}%`,
    `• Health score estimate: ${simulation.current.healthScore} → ${simulation.projected.healthScore}`,
  ].join('\n');
}

async function formatExpenseReduce(userId: string, snapshot: AffordabilitySnapshot, amount: number) {
  const projectedExpense = Math.max(0, snapshot.currentExpense - amount);
  const projectedSavings = snapshot.currentIncome - projectedExpense;
  const projectedSavingsRate =
    snapshot.currentIncome === 0
      ? 0
      : Number(((projectedSavings / snapshot.currentIncome) * 100).toFixed(1));

  const simulation = await runSimulation(userId, { extraSavingsMonthly: amount });

  return [
    `Based on the financial information currently recorded in SmartFin, reducing expenses by ${formatRs(amount)}/month would change ${snapshot.monthLabel} like this:`,
    '',
    ...snapshotLines(snapshot),
    '',
    `Projected change:`,
    `• Expenses: ${formatRs(snapshot.currentExpense)} → ${formatRs(projectedExpense)}`,
    `• Net savings: ${formatRs(snapshot.currentSavings)} → ${formatRs(projectedSavings)} (+${formatRs(amount)})`,
    `• Savings rate: ${snapshot.savingsRate}% → ${projectedSavingsRate}%`,
    `• Simulator-aligned savings delta: +${formatRs(simulation.delta.savings)} | Health score: ${simulation.current.healthScore} → ${simulation.projected.healthScore}`,
  ].join('\n');
}

async function formatMonthlySave(userId: string, snapshot: AffordabilitySnapshot, amount: number) {
  const simulation = await runSimulation(userId, { extraSavingsMonthly: amount });
  return [
    `Based on the financial information currently recorded in SmartFin, saving an extra ${formatRs(amount)} every month projects the following for ${simulation.monthLabel}:`,
    '',
    ...snapshotLines(snapshot),
    '',
    `Simulator results:`,
    `• Expenses: ${formatRs(simulation.current.expense)} → ${formatRs(simulation.projected.expense)}`,
    `• Net savings: ${formatRs(simulation.current.savings)} → ${formatRs(simulation.projected.savings)} (+${formatRs(simulation.delta.savings)})`,
    `• Savings rate: ${simulation.current.savingsRate}% → ${simulation.projected.savingsRate}%`,
    `• Health score estimate: ${simulation.current.healthScore} → ${simulation.projected.healthScore}`,
    snapshot.monthlySurplusAfterCommitments >= amount
      ? `• Your current surplus after EMIs and goals (${formatRs(snapshot.monthlySurplusAfterCommitments)}/month) can support this extra saving`
      : `• Your current surplus after EMIs and goals is ${formatRs(snapshot.monthlySurplusAfterCommitments)}/month — this saving target would require expense cuts or higher income`,
  ].join('\n');
}

export function buildWhatIfResponse(question: string, answer: string): StructuredAIResponse {
  const lines = answer.split('\n').filter(Boolean);
  const titleMatch = lines[0]?.match(/^Based on the financial information currently recorded in SmartFin, (.+?):$/i);
  return {
    title: titleMatch ? `What-If Analysis — ${titleMatch[1]}` : 'What-If Analysis',
    summary: answer,
    evidence: lines.filter((line) => line.startsWith('•') || line.includes('Rs.')),
    recommendation:
      'These figures use your recorded balance, income, expenses, recurring items, debts, goals, budgets, and emergency fund where available.',
    source: 'SmartFin What-If Analysis',
  };
}

export async function runWhatIfAnalysis(userId: string, scenario: WhatIfScenario): Promise<string> {
  const snapshot = await loadSnapshot(userId);

  switch (scenario.kind) {
    case 'afford':
      return formatAfford(snapshot, scenario.amount, scenario.label);
    case 'one_time_spend':
      return formatOneTimeSpend(snapshot, scenario.amount);
    case 'income_change_percent':
      return formatIncomeChange(userId, snapshot, scenario.percent);
    case 'expense_reduce':
      return formatExpenseReduce(userId, snapshot, scenario.amount);
    case 'monthly_save':
      return formatMonthlySave(userId, snapshot, scenario.amount);
    default:
      return 'I could not run that affordability scenario with the information provided.';
  }
}
