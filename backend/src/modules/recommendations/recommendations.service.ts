import { AppError } from '../../utils/AppError.js';
import { isDatabaseConnected } from '../../config/db.js';
import { getSummary } from '../summary/summary.service.js';
import { listBudgets } from '../budget/budget.service.js';
import { listGoals } from '../goal/goal.service.js';
import { getHealthScore } from '../score/score.service.js';
import { getLatestPrediction } from '../prediction/prediction.service.js';
import { Anomaly } from '../anomaly/anomaly.model.js';
import { getProfile } from '../profile/profile.service.js';

export type Recommendation = {
  id: string;
  title: string;
  description: string;
  category: 'spending' | 'budget' | 'savings' | 'prediction' | 'anomaly' | 'planning';
  type: 'warning' | 'tip' | 'positive';
  priority: number;
};

function assertDatabase() {
  if (!isDatabaseConnected()) {
    throw new AppError('Database is not connected. Try again in a moment.', 503);
  }
}

function formatRs(amount: number) {
  return `Rs. ${Math.round(amount).toLocaleString('en-US')}`;
}

export async function getRecommendations(userId: string) {
  assertDatabase();

  const [summary, budgetResult, goalResult, health, prediction, unresolvedCount, profile] = await Promise.all([
    getSummary(userId, { months: 6 }),
    listBudgets(userId, {}),
    listGoals(userId),
    getHealthScore(userId),
    getLatestPrediction(userId).catch(() => null),
    Anomaly.countDocuments({ userId, status: 'UNRESOLVED' }),
    getProfile(userId),
  ]);

  const items: Recommendation[] = [];
  const month = summary.currentMonth;

  if (month.savingsRate < 20 && month.income > 0) {
    items.push({
      id: 'savings-rate-low',
      title: 'Savings rate below target',
      description: `Your savings rate is ${month.savingsRate}% this month. Aim for at least 20% (${formatRs(month.income * 0.2)} of ${formatRs(month.income)} income).`,
      category: 'savings',
      type: 'warning',
      priority: 90,
    });
  } else if (month.savingsRate >= 20) {
    items.push({
      id: 'savings-rate-good',
      title: 'Healthy savings rate',
      description: `You saved ${month.savingsRate}% of income in ${month.label} — above the 20% target.`,
      category: 'savings',
      type: 'positive',
      priority: 40,
    });
  }

  if (month.wantsTotal > month.needsTotal && month.expense > 0) {
    const wantShare = Math.round((month.wantsTotal / month.expense) * 100);
    items.push({
      id: 'wants-exceed-needs',
      title: 'Wants exceed needs',
      description: `Discretionary (Want) spending is ${wantShare}% of total expenses. Review entertainment and shopping categories.`,
      category: 'spending',
      type: 'tip',
      priority: 70,
    });
  }

  const overBudgets = budgetResult.budgets.filter((b) => b.utilization > 100);
  for (const budget of overBudgets.slice(0, 2)) {
    items.push({
      id: `budget-over-${budget.id}`,
      title: `${budget.category || 'Overall'} budget exceeded`,
      description: `${budget.category || 'Overall'} is at ${budget.utilization}% (${formatRs(budget.spent)} of ${formatRs(budget.amount)}).`,
      category: 'budget',
      type: 'warning',
      priority: 85,
    });
  }

  const nearBudgets = budgetResult.budgets.filter((b) => b.utilization >= 80 && b.utilization <= 100);
  for (const budget of nearBudgets.slice(0, 1)) {
    items.push({
      id: `budget-near-${budget.id}`,
      title: `${budget.category || 'Overall'} budget nearly full`,
      description: `${budget.utilization}% used with ${formatRs(budget.remaining)} remaining this month.`,
      category: 'budget',
      type: 'tip',
      priority: 60,
    });
  }

  const overdueGoals = goalResult.goals.filter((g) => g.status === 'OVERDUE');
  for (const goal of overdueGoals.slice(0, 2)) {
    items.push({
      id: `goal-overdue-${goal.id}`,
      title: `Goal overdue: ${goal.name}`,
      description: `${formatRs(goal.remaining)} still needed. Required pace: ${formatRs(goal.requiredMonthly)}/month.`,
      category: 'savings',
      type: 'warning',
      priority: 80,
    });
  }

  const activeGoals = goalResult.goals.filter((g) => g.status === 'ACTIVE');
  for (const goal of activeGoals.slice(0, 1)) {
    const pct = goal.targetAmount === 0 ? 0 : Math.round((goal.currentAmount / goal.targetAmount) * 100);
    if (pct >= 50 && pct < 100) {
      items.push({
        id: `goal-progress-${goal.id}`,
        title: `${goal.name} is ${pct}% funded`,
        description: `Add ${formatRs(goal.requiredMonthly)}/month to reach ${goal.deadline}.`,
        category: 'savings',
        type: 'positive',
        priority: 50,
      });
    }
  }

  if (health.overallScore < 45) {
    items.push({
      id: 'health-at-risk',
      title: 'Financial health at risk',
      description: `Score is ${health.overallScore}/100 (${health.status}). Focus on: ${health.recommendations[0] || 'review budgets and savings.'}`,
      category: 'planning',
      type: 'warning',
      priority: 95,
    });
  } else if (health.overallScore >= 80) {
    items.push({
      id: 'health-excellent',
      title: 'Strong financial health',
      description: `Your score is ${health.overallScore}/100 (${health.status}). Keep current habits.`,
      category: 'planning',
      type: 'positive',
      priority: 30,
    });
  }

  if (prediction) {
    const pred = prediction;
    if (pred.changePercentage > 15) {
      items.push({
        id: 'prediction-increase',
        title: 'Forecast: spending may rise',
        description: `Next month predicted at ${formatRs(pred.predictedAmount)} (+${pred.changePercentage}% vs last month). Review budgets proactively.`,
        category: 'prediction',
        type: 'warning',
        priority: 75,
      });
    }
    const overallBudget = budgetResult.budgets.find((b) => !b.category);
    if (overallBudget && pred.predictedAmount > overallBudget.amount) {
      items.push({
        id: 'prediction-exceeds-budget',
        title: 'Forecast exceeds monthly budget',
        description: `Predicted ${formatRs(pred.predictedAmount)} vs budget ${formatRs(overallBudget.amount)}.`,
        category: 'prediction',
        type: 'warning',
        priority: 88,
      });
    }
  }

  if (unresolvedCount > 0) {
    items.push({
      id: 'anomalies-pending',
      title: `${unresolvedCount} unusual expense${unresolvedCount === 1 ? '' : 's'} pending review`,
      description: 'Review flagged transactions on the Anomalies page.',
      category: 'anomaly',
      type: 'warning',
      priority: 82,
    });
  }

  if (budgetResult.budgets.length === 0 && month.expense > 0) {
    items.push({
      id: 'no-budgets',
      title: 'Set a monthly budget',
      description: `You spent ${formatRs(month.expense)} in ${month.label} without a budget cap.`,
      category: 'budget',
      type: 'tip',
      priority: 65,
    });
  }

  if (goalResult.count === 0) {
    items.push({
      id: 'no-goals',
      title: 'Create a savings goal',
      description: 'Add an emergency fund or other goal to track progress toward financial targets.',
      category: 'savings',
      type: 'tip',
      priority: 55,
    });
  }

  if (profile.financialGoal) {
    items.push({
      id: 'profile-goal',
      title: `Profile goal: ${profile.financialGoal}`,
      description:
        profile.riskPreference === 'Low'
          ? 'Your low risk preference suits conservative saving and stable budgets.'
          : profile.riskPreference === 'High'
            ? 'High risk tolerance — ensure emergency fund covers 6 months before aggressive investing.'
            : `Align monthly savings with your "${profile.financialGoal}" target.`,
      category: 'planning',
      type: 'tip',
      priority: 58,
    });
  }

  if (profile.monthlyIncome && month.income > 0 && month.income < profile.monthlyIncome * 0.8) {
    items.push({
      id: 'income-below-profile',
      title: 'Income below profile baseline',
      description: `This month Rs. ${month.income.toLocaleString()} vs profile baseline Rs. ${profile.monthlyIncome.toLocaleString()}.`,
      category: 'planning',
      type: 'warning',
      priority: 72,
    });
  }

  items.sort((a, b) => b.priority - a.priority);

  return {
    recommendations: items.slice(0, 8),
    count: items.length,
  };
}
