import { AppError } from '../../utils/AppError.js';
import { isDatabaseConnected } from '../../config/db.js';
import { getSummary } from '../summary/summary.service.js';
import { listBudgets, PublicBudget } from '../budget/budget.service.js';
import { listGoals, PublicGoal } from '../goal/goal.service.js';
import { getProfile } from '../profile/profile.service.js';

export type HealthStatus = 'At Risk' | 'Moderate' | 'Good' | 'Excellent';

export type PublicHealthScore = {
  overallScore: number;
  status: HealthStatus;
  componentScores: {
    savingsRate: number;
    budgetAdherence: number;
    expenseStability: number;
    emergencyFund: number;
    goalProgress: number;
  };
  explanations: string[];
  recommendations: string[];
};

function assertDatabase() {
  if (!isDatabaseConnected()) {
    throw new AppError('Database is not connected. Try again in a moment.', 503);
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number) {
  return Number(value.toFixed(1));
}

function stdDev(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, item) => sum + item, 0) / values.length;
  const variance = values.reduce((sum, item) => sum + (item - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function statusFromScore(score: number): HealthStatus {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 45) return 'Moderate';
  return 'At Risk';
}

function savingsRateScore(income: number, expense: number, baselineIncome: number | null) {
  const effectiveIncome = income > 0 ? income : expense > 0 ? baselineIncome || 0 : 0;
  const rate = effectiveIncome === 0 ? 0 : ((effectiveIncome - expense) / effectiveIncome) * 100;
  const points = round1(clamp((rate / 20) * 25, 0, 25));
  const explanations: string[] = [];
  const recommendations: string[] = [];

  if (effectiveIncome === 0) {
    explanations.push('No income this month, so the savings-rate factor is 0. Add income to score this properly.');
    recommendations.push('Record this month’s income so savings rate can be measured against a real baseline.');
  } else if (rate >= 20) {
    explanations.push(`Savings rate is healthy at ${rate.toFixed(1)}% of income (target ≥ 20%).`);
  } else if (rate >= 0) {
    explanations.push(`Savings rate is ${rate.toFixed(1)}% of income (target ≥ 20%).`);
    recommendations.push('Aim to keep at least 20% of income after expenses, even if that means trimming wants first.');
  } else {
    explanations.push(`Spending exceeds income this month (savings rate ${rate.toFixed(1)}%).`);
    recommendations.push('Bring this month’s expenses below income before adding new discretionary spend.');
  }

  return { points, rate, explanations, recommendations };
}

function budgetAdherenceScore(budgets: PublicBudget[]) {
  const explanations: string[] = [];
  const recommendations: string[] = [];

  if (budgets.length === 0) {
    explanations.push('No budgets set for this month, so budget adherence scores 0.');
    recommendations.push('Add an overall or category budget so overspend can be tracked against a limit.');
    return { points: 0, explanations, recommendations };
  }

  const perBudget = budgets.map((budget) => {
    if (budget.utilization <= 100) return 20;
    return clamp(20 * (1 - (budget.utilization - 100) / 50), 0, 20);
  });
  const points = round1(perBudget.reduce((sum, item) => sum + item, 0) / perBudget.length);

  const over = budgets.filter((budget) => budget.utilization > 100);
  if (over.length === 0) {
    explanations.push(`All ${budgets.length} budget${budgets.length === 1 ? '' : 's'} are within limit this month.`);
  } else {
    const labels = over
      .map((budget) => `${budget.category || 'Overall'} at ${budget.utilization}%`)
      .slice(0, 3)
      .join('; ');
    explanations.push(`Over budget: ${labels}.`);
    const worst = [...over].sort((a, b) => b.utilization - a.utilization)[0];
    recommendations.push(
      `Cap ${worst.category || 'overall'} spend next month — it is at ${worst.utilization}% of its Rs. ${worst.amount.toLocaleString()} limit.`
    );
  }

  return { points, explanations, recommendations };
}

function expenseStabilityScore(monthlyExpenses: number[]) {
  const explanations: string[] = [];
  const recommendations: string[] = [];
  const active = monthlyExpenses.filter((amount) => amount > 0);

  if (active.length < 2) {
    explanations.push('Need at least two months of expenses to judge spending stability.');
    recommendations.push('Keep logging expenses each month so volatility can be measured.');
    return { points: 7.5, explanations, recommendations };
  }

  const mean = active.reduce((sum, item) => sum + item, 0) / active.length;
  const cv = mean === 0 ? 0 : stdDev(active) / mean;
  const points = round1(clamp(15 * (1 - cv / 0.4), 0, 15));

  if (cv <= 0.15) {
    explanations.push(`Spending is stable (variation ${(cv * 100).toFixed(0)}% across recent months).`);
  } else if (cv <= 0.4) {
    explanations.push(`Spending varies ${(cv * 100).toFixed(0)}% month to month, which reduces the stability score.`);
    recommendations.push('Smooth large one-off purchases across months, or mark them as planned so the rest of spend stays even.');
  } else {
    explanations.push(`Spending is volatile (variation ${(cv * 100).toFixed(0)}% across recent months).`);
    recommendations.push('Set category limits for the most variable areas so monthly spend does not swing as hard.');
  }

  return { points, explanations, recommendations };
}

function emergencyFundScore(goals: PublicGoal[], avgMonthlyExpense: number) {
  const explanations: string[] = [];
  const recommendations: string[] = [];
  const emergencyGoals = goals.filter((goal) => /emergency/i.test(goal.name));
  const balance = emergencyGoals.reduce((sum, goal) => sum + goal.currentAmount, 0);

  if (emergencyGoals.length === 0) {
    explanations.push('No emergency-fund goal found, so the reserve factor is 0. Name a goal “Emergency Fund” to include it.');
    recommendations.push('Create an emergency-fund goal and fund it toward 6 months of typical expenses.');
    return { points: 0, explanations, recommendations };
  }

  const monthsCovered = avgMonthlyExpense > 0 ? balance / avgMonthlyExpense : balance > 0 ? 6 : 0;
  const points = round1(clamp((monthsCovered / 6) * 20, 0, 20));

  if (avgMonthlyExpense === 0) {
    explanations.push(
      `Emergency fund is Rs. ${balance.toLocaleString()}, but there is not enough expense history to convert that into months of cover.`
    );
  } else if (monthsCovered >= 6) {
    explanations.push(
      `Emergency fund covers about ${monthsCovered.toFixed(1)} months of expenses (target: 6 months).`
    );
  } else {
    explanations.push(
      `Emergency fund covers about ${monthsCovered.toFixed(1)} months of expenses (target: 6 months).`
    );
    const needed = Math.max(0, Math.ceil(avgMonthlyExpense * 6 - balance));
    recommendations.push(`Add about Rs. ${needed.toLocaleString()} to the emergency fund to reach 6 months of cover.`);
  }

  return { points, explanations, recommendations };
}

function goalProgressScore(goals: PublicGoal[]) {
  const explanations: string[] = [];
  const recommendations: string[] = [];

  if (goals.length === 0) {
    explanations.push('No savings goals yet, so goal-pace scores 0.');
    recommendations.push('Add a savings goal with a deadline so monthly contributions can be paced.');
    return { points: 0, explanations, recommendations };
  }

  const ratios = goals.map((goal) => {
    const pct = goal.targetAmount === 0 ? 1 : clamp(goal.currentAmount / goal.targetAmount, 0, 1);
    if (goal.status === 'COMPLETED') return 1;
    if (goal.status === 'OVERDUE') return pct * 0.5;
    return pct;
  });
  const points = round1((ratios.reduce((sum, item) => sum + item, 0) / ratios.length) * 20);

  const completed = goals.filter((goal) => goal.status === 'COMPLETED').length;
  const overdue = goals.filter((goal) => goal.status === 'OVERDUE');
  const active = goals.filter((goal) => goal.status === 'ACTIVE');

  if (completed > 0) {
    explanations.push(`${completed} savings goal${completed === 1 ? '' : 's'} already completed.`);
  }

  if (overdue.length > 0) {
    explanations.push(`${overdue.length} goal${overdue.length === 1 ? ' is' : 's are'} past the deadline with remaining balances.`);
    recommendations.push(
      `Update the deadline or current amount on “${overdue[0].name}” — Rs. ${overdue[0].remaining.toLocaleString()} is still unpaid.`
    );
  } else if (active.length > 0) {
    const furthest = [...active].sort(
      (a, b) => a.currentAmount / a.targetAmount - b.currentAmount / b.targetAmount
    )[0];
    const pct = Math.round((furthest.currentAmount / furthest.targetAmount) * 100);
    explanations.push(
      `“${furthest.name}” is ${pct}% funded and needs about Rs. ${furthest.requiredMonthly.toLocaleString()} per month to hit the deadline.`
    );
    if (pct < 50) {
      recommendations.push(
        `Put Rs. ${furthest.requiredMonthly.toLocaleString()} toward “${furthest.name}” each month to stay on pace.`
      );
    }
  }

  return { points, explanations, recommendations };
}

export type EmergencyFundPlan = {
  currentBalance: number;
  targetMonths: number;
  avgMonthlyExpense: number;
  targetAmount: number;
  monthsCovered: number;
  amountNeeded: number;
  progressPercent: number;
  status: 'Not started' | 'Building' | 'Adequate' | 'Fully funded';
  goalId: string | null;
  goalName: string | null;
  recommendations: string[];
};

export async function getEmergencyFundPlan(userId: string): Promise<EmergencyFundPlan> {
  assertDatabase();

  const [summary, goalResult] = await Promise.all([
    getSummary(userId, { months: 6 }),
    listGoals(userId),
  ]);

  const last3 = summary.monthly.slice(-3);
  const avgMonthlyExpense =
    last3.length === 0 ? 0 : last3.reduce((sum, row) => sum + row.expense, 0) / last3.length;

  const targetMonths = 6;
  const emergencyGoals = goalResult.goals.filter((goal) => /emergency/i.test(goal.name));
  const primaryGoal = emergencyGoals[0] || null;
  const currentBalance = emergencyGoals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const targetAmount = avgMonthlyExpense > 0 ? Math.ceil(avgMonthlyExpense * targetMonths) : primaryGoal?.targetAmount || 0;
  const monthsCovered = avgMonthlyExpense > 0 ? currentBalance / avgMonthlyExpense : currentBalance > 0 ? targetMonths : 0;
  const amountNeeded = Math.max(0, targetAmount - currentBalance);
  const progressPercent = targetAmount === 0 ? 0 : Math.min(100, Math.round((currentBalance / targetAmount) * 100));

  let status: EmergencyFundPlan['status'] = 'Not started';
  if (currentBalance <= 0 && emergencyGoals.length === 0) {
    status = 'Not started';
  } else if (monthsCovered >= targetMonths) {
    status = 'Fully funded';
  } else if (monthsCovered >= 3) {
    status = 'Adequate';
  } else {
    status = 'Building';
  }

  const recommendations: string[] = [];
  if (emergencyGoals.length === 0) {
    recommendations.push('Create a savings goal named "Emergency Fund" to track your reserve.');
  }
  if (amountNeeded > 0 && avgMonthlyExpense > 0) {
    recommendations.push(`Add ${formatRs(amountNeeded)} to reach ${targetMonths} months of expenses (${formatRs(avgMonthlyExpense)}/month average).`);
    const monthlyContribution = Math.ceil(amountNeeded / Math.max(1, targetMonths - monthsCovered));
    recommendations.push(`Save about ${formatRs(monthlyContribution)}/month to reach the target within ${Math.max(1, Math.ceil(targetMonths - monthsCovered))} months.`);
  }
  if (monthsCovered >= targetMonths) {
    recommendations.push('Your emergency fund meets the 6-month target. Consider directing surplus to other goals.');
  }

  return {
    currentBalance,
    targetMonths,
    avgMonthlyExpense: Math.round(avgMonthlyExpense),
    targetAmount,
    monthsCovered: Number(monthsCovered.toFixed(1)),
    amountNeeded,
    progressPercent,
    status,
    goalId: primaryGoal?.id || null,
    goalName: primaryGoal?.name || null,
    recommendations,
  };
}

function formatRs(amount: number) {
  return `Rs. ${Math.round(amount).toLocaleString('en-US')}`;
}

export async function getHealthScore(userId: string): Promise<PublicHealthScore> {
  assertDatabase();

  const [summary, budgetResult, goalResult, profile] = await Promise.all([
    getSummary(userId, { months: 6 }),
    listBudgets(userId, {}),
    listGoals(userId),
    getProfile(userId),
  ]);

  const income = summary.currentMonth.income;
  const expense = summary.currentMonth.expense;
  const last3 = summary.monthly.slice(-3);
  const avgMonthlyExpense =
    last3.length === 0 ? 0 : last3.reduce((sum, row) => sum + row.expense, 0) / last3.length;

  const savings = savingsRateScore(income, expense, profile.monthlyIncome);
  const budget = budgetAdherenceScore(budgetResult.budgets);
  const stability = expenseStabilityScore(summary.monthly.map((row) => row.expense));
  const emergency = emergencyFundScore(goalResult.goals, avgMonthlyExpense);
  const goals = goalProgressScore(goalResult.goals);

  const overallScore = Math.round(
    clamp(savings.points + budget.points + stability.points + emergency.points + goals.points, 0, 100)
  );

  const explanations = [
    ...savings.explanations,
    ...budget.explanations,
    ...stability.explanations,
    ...emergency.explanations,
    ...goals.explanations,
  ].slice(0, 6);

  const recommendations = [
    ...savings.recommendations,
    ...budget.recommendations,
    ...stability.recommendations,
    ...emergency.recommendations,
    ...goals.recommendations,
  ].slice(0, 5);

  if (recommendations.length === 0) {
    recommendations.push('Keep logging income and expenses. The score will move as this month’s totals change.');
  }

  return {
    overallScore,
    status: statusFromScore(overallScore),
    componentScores: {
      savingsRate: savings.points,
      budgetAdherence: budget.points,
      expenseStability: stability.points,
      emergencyFund: emergency.points,
      goalProgress: goals.points,
    },
    explanations,
    recommendations,
  };
}
