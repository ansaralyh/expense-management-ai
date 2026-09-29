import type { BudgetVariance, CategoryTotal, MonthlyPoint } from '../services/summary.service';

export function categoryWithShare(categories: CategoryTotal[], totalExpense: number) {
  return categories.map((item) => ({
    ...item,
    share: totalExpense === 0 ? 0 : Math.round((item.amount / totalExpense) * 100),
  }));
}

export function monthlyWithRates(monthly: MonthlyPoint[]) {
  return monthly.map((row) => ({
    ...row,
    savingsRate: row.income === 0 ? 0 : Number(((row.savings / row.income) * 100).toFixed(1)),
  }));
}

export function budgetStatusLabel(status: BudgetVariance['status']) {
  if (status === 'over') return 'Over budget';
  if (status === 'under') return 'Under budget';
  return 'On track';
}

export function trendLabel(change: number) {
  if (change === 0) return 'No change vs prior month';
  return `${change >= 0 ? '+' : ''}${change}% vs prior month`;
}
