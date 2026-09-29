import { AppError } from '../../utils/AppError.js';
import { isDatabaseConnected } from '../../config/db.js';
import { getSummary } from '../summary/summary.service.js';
import { getHealthScore } from '../score/score.service.js';
import { SimulateInput } from './simulator.validation.js';

function assertDatabase() {
  if (!isDatabaseConnected()) {
    throw new AppError('Database is not connected. Try again in a moment.', 503);
  }
}

export async function runSimulation(userId: string, input: SimulateInput) {
  assertDatabase();

  const [summary, currentHealth] = await Promise.all([
    getSummary(userId, { months: 6 }),
    getHealthScore(userId),
  ]);

  const month = summary.currentMonth;
  let projectedExpense = month.expense;
  let projectedIncome = month.income;
  const adjustments: string[] = [];

  if (input.incomeChangePercent !== 0) {
    projectedIncome = month.income * (1 + input.incomeChangePercent / 100);
    adjustments.push(
      `Income ${input.incomeChangePercent >= 0 ? '+' : ''}${input.incomeChangePercent}% → Rs. ${Math.round(projectedIncome).toLocaleString()}`
    );
  }

  if (input.category && input.categoryCutPercent > 0) {
    const cat = month.byCategory.find((c) => c.category === input.category);
    const catAmount = cat?.amount || 0;
    const cut = catAmount * (input.categoryCutPercent / 100);
    projectedExpense -= cut;
    adjustments.push(
      `Cut ${input.category} by ${input.categoryCutPercent}% → save Rs. ${Math.round(cut).toLocaleString()}/month`
    );
  }

  if (input.extraSavingsMonthly > 0) {
    projectedExpense -= input.extraSavingsMonthly;
    adjustments.push(`Extra savings Rs. ${input.extraSavingsMonthly.toLocaleString()}/month`);
  }

  projectedExpense = Math.max(0, projectedExpense);
  const projectedSavings = projectedIncome - projectedExpense;
  const projectedSavingsRate =
    projectedIncome === 0 ? 0 : Number(((projectedSavings / projectedIncome) * 100).toFixed(1));

  const savingsDelta = projectedSavings - month.savings;
  const savingsRateDelta = projectedSavingsRate - month.savingsRate;

  let projectedHealthScore = currentHealth.overallScore;
  if (projectedSavingsRate >= 20 && month.savingsRate < 20) projectedHealthScore += 5;
  if (projectedSavingsRate < 10 && month.savingsRate >= 10) projectedHealthScore -= 5;
  projectedHealthScore = Math.min(100, Math.max(0, projectedHealthScore));

  return {
    current: {
      income: month.income,
      expense: month.expense,
      savings: month.savings,
      savingsRate: month.savingsRate,
      healthScore: currentHealth.overallScore,
    },
    projected: {
      income: Math.round(projectedIncome),
      expense: Math.round(projectedExpense),
      savings: Math.round(projectedSavings),
      savingsRate: projectedSavingsRate,
      healthScore: projectedHealthScore,
    },
    delta: {
      savings: Math.round(savingsDelta),
      savingsRate: Number(savingsRateDelta.toFixed(1)),
      healthScore: projectedHealthScore - currentHealth.overallScore,
    },
    adjustments,
    monthLabel: month.label,
  };
}
