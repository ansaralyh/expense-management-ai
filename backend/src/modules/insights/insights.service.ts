import { isDatabaseConnected } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { getSummary } from '../summary/summary.service.js';
import { listBudgets } from '../budget/budget.service.js';
import { listGoals } from '../goal/goal.service.js';
import { getSubscriptionsAnalysis } from '../subscriptions/subscriptions.service.js';
import { Anomaly } from '../anomaly/anomaly.model.js';
import { getLatestPrediction } from '../prediction/prediction.service.js';

export type InsightType =
  | 'SPENDING_SPIKE'
  | 'SAVINGS_IMPROVEMENT'
  | 'SAVINGS_DECLINE'
  | 'BUDGET_RISK'
  | 'GOAL_PROGRESS'
  | 'SUBSCRIPTION_CHANGE'
  | 'UNUSUAL_TRANSACTION'
  | 'DEBT_PROGRESS'
  | 'NET_WORTH_CHANGE'
  | 'RECURRING_PAYMENT'
  | 'FORECAST_RISK';

export type AIInsightItem = {
  id: string;
  type: InsightType;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  metric?: string;
  comparison?: string;
  createdAt: string;
  action?: { label: string; href: string };
};

function assertDatabase() {
  if (!isDatabaseConnected()) {
    throw new AppError('Database is not connected.', 503);
  }
}

export async function generateAIInsights(userId: string): Promise<AIInsightItem[]> {
  assertDatabase();

  const [summary, budgetResult, goalResult, subsSummary, unresolvedAnomalies, prediction] = await Promise.all([
    getSummary(userId, { months: 6 }).catch(() => null),
    listBudgets(userId, {}).catch(() => ({ budgets: [] })),
    listGoals(userId).catch(() => ({ goals: [] })),
    getSubscriptionsAnalysis(userId).catch(() => ({ totalMonthlyCommitments: 0, subscriptions: [], priceIncreaseAlerts: [] })),
    Anomaly.find({ userId, status: 'UNRESOLVED' }).limit(3).lean().catch(() => []),
    getLatestPrediction(userId).catch(() => null),
  ]);

  const insights: AIInsightItem[] = [];
  const now = new Date().toISOString();

  if (summary) {
    const cur = summary.currentMonth;
    if (cur.savingsRate >= 20) {
      insights.push({
        id: 'savings-great',
        type: 'SAVINGS_IMPROVEMENT',
        severity: 'low',
        title: 'Savings rate is on track',
        description: `You saved ${cur.savingsRate}% of your income in ${cur.label}. Total saved: Rs. ${cur.savings.toLocaleString()}.`,
        metric: `${cur.savingsRate}%`,
        createdAt: now,
        action: { label: 'View Savings Goals', href: '/savings-goals' },
      });
    } else if (cur.income > 0 && cur.savingsRate < 10) {
      insights.push({
        id: 'savings-low',
        type: 'SAVINGS_DECLINE',
        severity: 'high',
        title: 'Low savings rate this month',
        description: `Your savings rate dropped to ${cur.savingsRate}%. High discretionary spending may be impacting your goals.`,
        metric: `${cur.savingsRate}%`,
        createdAt: now,
        action: { label: 'Review Budgets', href: '/budgets' },
      });
    }

    if (cur.byCategory && cur.byCategory.length > 0) {
      const topCat = cur.byCategory[0];
      if (topCat.amount > cur.expense * 0.35 && cur.expense > 0) {
        insights.push({
          id: `spike-${topCat.category}`,
          type: 'SPENDING_SPIKE',
          severity: 'medium',
          title: `High spending in ${topCat.category}`,
          description: `${topCat.category} accounts for ${Math.round((topCat.amount / cur.expense) * 100)}% of total monthly expenses (Rs. ${topCat.amount.toLocaleString()}).`,
          metric: `Rs. ${topCat.amount.toLocaleString()}`,
          createdAt: now,
          action: { label: 'View Category Expenses', href: '/expenses' },
        });
      }
    }
  }

  if (subsSummary.totalMonthlyCommitments > 0) {
    insights.push({
      id: 'recurring-summary',
      type: 'RECURRING_PAYMENT',
      severity: 'low',
      title: 'Active Monthly Subscriptions',
      description: `Your recurring monthly commitments total Rs. ${subsSummary.totalMonthlyCommitments.toLocaleString()}/month across ${subsSummary.subscriptions.length} services.`,
      metric: `Rs. ${subsSummary.totalMonthlyCommitments.toLocaleString()}/mo`,
      createdAt: now,
      action: { label: 'Manage Subscriptions', href: '/recurring' },
    });
  }

  if (subsSummary.priceIncreaseAlerts.length > 0) {
    insights.push({
      id: 'sub-increase',
      type: 'SUBSCRIPTION_CHANGE',
      severity: 'high',
      title: 'Subscription Price Increase Detected',
      description: subsSummary.priceIncreaseAlerts[0],
      createdAt: now,
      action: { label: 'View Subscriptions', href: '/recurring' },
    });
  }

  const overBudget = budgetResult.budgets.find((b) => b.utilization > 100);
  if (overBudget) {
    insights.push({
      id: `budget-over-${overBudget.id}`,
      type: 'BUDGET_RISK',
      severity: 'high',
      title: `${overBudget.category || 'Overall'} Budget Exceeded`,
      description: `You have spent ${overBudget.utilization}% of your Rs. ${overBudget.amount.toLocaleString()} limit.`,
      metric: `${overBudget.utilization}%`,
      createdAt: now,
      action: { label: 'Adjust Budget', href: '/budgets' },
    });
  }

  if (unresolvedAnomalies.length > 0) {
    const first = unresolvedAnomalies[0];
    insights.push({
      id: `anomaly-${first._id}`,
      type: 'UNUSUAL_TRANSACTION',
      severity: 'high',
      title: 'Unusual Spending Detected',
      description: `Rs. ${first.amount.toLocaleString()} on ${first.expenseDescription} is ${first.reason || 'unusually high'}.`,
      metric: `Rs. ${first.amount.toLocaleString()}`,
      createdAt: now,
      action: { label: 'Review Anomalies', href: '/anomalies' },
    });
  }

  if (prediction && prediction.changePercentage > 15) {
    insights.push({
      id: 'pred-risk',
      type: 'FORECAST_RISK',
      severity: 'medium',
      title: 'Forecasted Spending Surge',
      description: `Next month expense forecast is Rs. ${prediction.predictedAmount.toLocaleString()} (+${prediction.changePercentage}% vs baseline).`,
      metric: `+${prediction.changePercentage}%`,
      createdAt: now,
      action: { label: 'View Predictions', href: '/predictions' },
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: 'empty-insight',
      type: 'GOAL_PROGRESS',
      severity: 'low',
      title: 'Finances are Steady',
      description: 'No major unusual spending or budget alerts detected for the active month.',
      createdAt: now,
      action: { label: 'View Dashboard', href: '/dashboard' },
    });
  }

  return insights.slice(0, 6);
}
