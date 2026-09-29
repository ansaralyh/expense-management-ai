import mongoose from 'mongoose';
import { getSummary } from '../summary/summary.service.js';
import { listBudgets } from '../budget/budget.service.js';
import { listGoals } from '../goal/goal.service.js';
import { getProfile } from '../profile/profile.service.js';
import { getHealthScore } from '../score/score.service.js';
import { Anomaly } from '../anomaly/anomaly.model.js';
import { NetWorthItem } from '../networth/networth.model.js';
import { FinancialContextPayload } from './ai-provider.js';

export async function buildSecureFinancialContext(userId: string): Promise<FinancialContextPayload> {
  const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

  const [profile, summary, budgetResult, goalResult, health, unresolvedAnomaliesCount, netWorthItems] = await Promise.all([
    getProfile(userId).catch(() => ({ name: 'User' })),
    getSummary(userId, { months: 6 }).catch(() => ({
      currentMonth: {
        key: new Date().toISOString().slice(0, 7),
        label: 'Current Month',
        income: 0,
        expense: 0,
        savings: 0,
        savingsRate: 0,
        byCategory: [],
      },
    })),
    listBudgets(userId, {}).catch(() => ({ budgets: [] })),
    listGoals(userId).catch(() => ({ goals: [] })),
    getHealthScore(userId).catch(() => null),
    Anomaly.countDocuments({ userId: userObjectId, status: 'UNRESOLVED' }).catch(() => 0),
    NetWorthItem.find({ userId: userObjectId }).lean().catch(() => []),
  ]);

  const currentMonth = summary.currentMonth;

  let netWorthVal = 0;
  if (Array.isArray(netWorthItems) && netWorthItems.length > 0) {
    const totalAssets = netWorthItems.filter((i) => i.kind === 'asset').reduce((sum, item) => sum + (item.value || 0), 0);
    const totalLiabilities = netWorthItems.filter((i) => i.kind === 'liability').reduce((sum, item) => sum + (item.value || 0), 0);
    netWorthVal = totalAssets - totalLiabilities;
  }

  return {
    userName: profile.name || 'User',
    monthLabel: currentMonth.label,
    income: currentMonth.income,
    expense: currentMonth.expense,
    savings: currentMonth.savings,
    savingsRate: currentMonth.savingsRate,
    topCategories: (currentMonth.byCategory || []).slice(0, 5).map((cat) => ({
      category: cat.category,
      amount: cat.amount,
    })),
    budgets: (budgetResult.budgets || []).slice(0, 8).map((b) => ({
      label: b.category || 'Overall',
      amount: b.amount,
      spent: b.spent,
      utilization: b.utilization,
    })),
    goals: (goalResult.goals || []).slice(0, 5).map((g) => ({
      name: g.name,
      target: g.targetAmount,
      current: g.currentAmount,
      status: g.status,
    })),
    healthScore: health ? health.overallScore : null,
    healthStatus: health ? health.status : null,
    netWorth: netWorthVal,
    unresolvedAnomaliesCount,
  };
}
