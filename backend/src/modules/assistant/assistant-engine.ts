import { ParsedPeriod, shiftMonth } from './date-parser.js';
import {
  buildStructuredContext,
  ChatTurn,
  StructuredConversationContext,
  resolveCategory,
  resolvePeriod,
} from './conversation-context.js';
import {
  compareMonths,
  getBudgetStatus,
  getLargestExpense,
  getMonthTotals,
  getSalaryIncome,
  getSalaryTransactionCount,
  getCategoryExpenses,
} from './financial-query.service.js';
import { Intent, parseIntents } from './intent-parser.js';
import { runWhatIfAnalysis } from './affordability.service.js';
import { getStaticEducationResponse } from './financial-education.service.js';
import {
  buildConversationalResponse,
  buildOffTopicResponse,
  buildOpenFinanceGuidance,
  isFinanceRelatedQuestion,
  knowledgeToStructuredResponse,
  matchKnowledgeQuestion,
} from './assistant-knowledge.js';
import {
  formatCategoryDriver,
  formatCategoryExpense,
  formatExpenseChangeWhy,
  formatLargestExpense,
  formatMonthlyComparison,
  formatMonthlySummary,
  formatNetSavings,
  formatRs,
  formatSalaryCount,
  formatSalaryIncome,
  formatSavingsChangeWhy,
  formatSpendingVsEarning,
  formatTopCategories,
  formatTotalExpense,
  formatTotalIncome,
} from './response-builder.js';
import type { EducationTopic } from './financial-education.service.js';

type BudgetRow = {
  label: string;
  amount: number;
  spent: number;
  remaining: number;
  utilization: number;
};

type GoalRow = {
  name: string;
  remaining: number;
  requiredMonthly: number;
  status: string;
};

type HealthRow = {
  overallScore: number;
  status: string;
  recommendations: string[];
};

type PredictionRow = {
  period: string;
  amount: number;
  changePercentage: number;
  modelUsed: string;
  categories: { category: string; predictedAmount: number }[];
};

export type EngineContext = {
  name: string;
  monthKey: string;
  monthLabel: string;
  budgets: BudgetRow[];
  goals: GoalRow[];
  health: HealthRow | null;
  prediction: PredictionRow | null;
};

export type EngineResult = {
  answer: string;
  confidence: 'high' | 'low';
  intentType?: string;
  educationTopic?: EducationTopic | string;
  isEducation?: boolean;
  isWhatIf?: boolean;
  isConversational?: boolean;
  conversationalKind?: 'greeting' | 'thanks' | 'farewell' | 'small_talk' | 'platform_help';
  structuredOverride?: import('./ai-provider.js').StructuredAIResponse;
};

function periodToRange(
  period: ParsedPeriod | undefined,
  question: string,
  ctx: StructuredConversationContext,
  refDate: Date
) {
  if (period?.kind === 'single') {
    return period.range;
  }
  return resolvePeriod(question, ctx, refDate);
}

function budgetLabel(category: string | null | undefined) {
  return category || 'Overall';
}

async function executeIntent(
  intent: Intent,
  userId: string,
  question: string,
  convoCtx: StructuredConversationContext,
  engineCtx: EngineContext,
  refDate: Date
): Promise<string> {
  if (intent.type === 'GREETING' || intent.type === 'CONVERSATIONAL') {
    const firstName = engineCtx.name.split(' ')[0] || 'there';
    const kind =
      intent.type === 'CONVERSATIONAL'
        ? intent.kind
        : 'greeting';
    return buildConversationalResponse(kind, firstName).summary;
  }

  if (intent.type === 'HELP') {
    return buildConversationalResponse('platform_help', engineCtx.name.split(' ')[0] || 'there').summary;
  }

  if (intent.type === 'WHAT_IF') {
    return runWhatIfAnalysis(userId, intent.scenario);
  }

  if (intent.type === 'FINANCIAL_EDUCATION') {
    const knowledge = matchKnowledgeQuestion(question);
    if (knowledge) {
      return knowledgeToStructuredResponse(knowledge).summary;
    }
    return getStaticEducationResponse(intent.topic as EducationTopic).summary;
  }

  if (intent.type === 'EXPENSE_CHANGE_WHY') {
    const range = periodToRange(intent.period, question, convoCtx, refDate);
    const prevKey = shiftMonth(range.monthKey, -1);
    const result = await compareMonths(userId, prevKey, range.monthKey);
    return formatExpenseChangeWhy(result.b, result.a, result.expenseDelta);
  }

  if (intent.type === 'SAVINGS_CHANGE_WHY') {
    const range = periodToRange(intent.period, question, convoCtx, refDate);
    const prevKey = shiftMonth(range.monthKey, -1);
    const result = await compareMonths(userId, prevKey, range.monthKey);
    const savingsDelta = result.b.savings - result.a.savings;
    return formatSavingsChangeWhy(result.b, result.a, savingsDelta);
  }

  if (intent.type === 'CATEGORY_DRIVER') {
    const range = periodToRange(intent.period, question, convoCtx, refDate);
    const prevKey = shiftMonth(range.monthKey, -1);
    const result = await compareMonths(userId, prevKey, range.monthKey);
    return formatCategoryDriver(result.b, result.a);
  }

  if (intent.type === 'COMPOSITE') {
    const parts: string[] = [];
    for (const sub of intent.intents) {
      parts.push(await executeIntent(sub, userId, question, convoCtx, engineCtx, refDate));
    }
    return parts.join('\n\n');
  }

  if (intent.type === 'MONTHLY_COMPARISON') {
    const [a, b] = intent.period.ranges;
    const result = await compareMonths(userId, a.monthKey, b.monthKey);
    return formatMonthlyComparison(result.a, result.b, result.expenseDelta, result.incomeDelta);
  }

  if (intent.type === 'SAVINGS_GOAL_STATUS') {
    if (engineCtx.goals.length === 0) {
      return 'You have not added a savings goal yet. Add one on the Savings Goals page.';
    }
    return engineCtx.goals
      .map(
        (goal) =>
          `${goal.name} is ${goal.status.toLowerCase()} — ${formatRs(goal.remaining)} left${
            goal.requiredMonthly > 0 ? `, about ${formatRs(goal.requiredMonthly)} / month` : ''
          }.`
      )
      .join('\n');
  }

  if (intent.type === 'FORECAST') {
    if (!engineCtx.prediction) {
      return 'I do not have a forecast yet. Open Predictions, train the model, then ask again.';
    }
    const sign = engineCtx.prediction.changePercentage >= 0 ? '+' : '';
    const categories = engineCtx.prediction.categories
      .filter((row) => row.predictedAmount > 0)
      .sort((a, b) => b.predictedAmount - a.predictedAmount)
      .slice(0, 4)
      .map((row) => `${row.category} ${formatRs(row.predictedAmount)}`)
      .join(', ');

    let reply = `The latest forecast for ${engineCtx.prediction.period} is ${formatRs(engineCtx.prediction.amount)} (${sign}${engineCtx.prediction.changePercentage}% vs ${engineCtx.monthLabel}).`;
    if (categories) {
      reply += ` Breakdown: ${categories}.`;
    }
    return reply;
  }

  if (intent.type === 'FINANCIAL_HEALTH') {
    if (!engineCtx.health) {
      return 'A health score is not available yet.';
    }
    const tip = engineCtx.health.recommendations[0] ? ` ${engineCtx.health.recommendations[0]}` : '';
    return `Your financial health score is ${engineCtx.health.overallScore}/100 (${engineCtx.health.status}).${tip}`;
  }

  if (intent.type === 'BUDGET_STATUS') {
    const range = periodToRange(intent.period, question, convoCtx, refDate);
    const budgetRows = await getBudgetStatus(userId, range.monthKey);
    const budgets = budgetRows.map((budget) => ({
      label: budgetLabel(budget.category),
      amount: budget.amount,
      spent: budget.spent,
      remaining: budget.remaining,
      utilization: budget.utilization,
    }));

    if (budgets.length === 0) {
      return `You have not set a budget for ${range.label} yet. Add one on the Budgets page.`;
    }

    const over = budgets.filter((item) => item.utilization > 100);
    if (over.length > 0) {
      return over
        .map(
          (item) =>
            `${item.label} is over budget at ${item.utilization}% (${formatRs(item.spent)} spent vs ${formatRs(item.amount)} limit).`
        )
        .join('\n');
    }

    return budgets
      .map(
        (item) =>
          `${item.label}: limit ${formatRs(item.amount)}, spent ${formatRs(item.spent)}, ${formatRs(item.remaining)} left (${item.utilization}%).`
      )
      .join('\n');
  }

  const range = periodToRange(intent.period, question, convoCtx, refDate);
  const totals = await getMonthTotals(userId, range.monthKey);

  if (intent.type === 'TOTAL_EXPENSE') {
    return formatTotalExpense(totals);
  }

  if (intent.type === 'TOTAL_INCOME') {
    return formatTotalIncome(totals);
  }

  if (intent.type === 'NET_SAVINGS') {
    return formatNetSavings(totals);
  }

  if (intent.type === 'MONTHLY_SUMMARY') {
    return formatMonthlySummary(totals);
  }

  if (intent.type === 'SPENDING_VS_EARNING') {
    return formatSpendingVsEarning(totals);
  }

  if (intent.type === 'NEED_VS_WANT') {
    if (totals.expense === 0) {
      return `No expenses are recorded for ${totals.label}, so Need vs Want cannot be calculated.`;
    }
    const needShare = Number(((totals.needsTotal / totals.expense) * 100).toFixed(1));
    const wantShare = Number(((totals.wantsTotal / totals.expense) * 100).toFixed(1));
    return `In ${totals.label}, needs are ${formatRs(totals.needsTotal)} (${needShare}%) and wants are ${formatRs(totals.wantsTotal)} (${wantShare}%).`;
  }

  if (intent.type === 'TOP_EXPENSE_CATEGORIES') {
    return formatTopCategories(totals);
  }

  if (intent.type === 'LARGEST_EXPENSE') {
    const item = await getLargestExpense(userId, range);
    return formatLargestExpense(item);
  }

  if (intent.type === 'SALARY_INCOME') {
    const salary = await getSalaryIncome(userId, range);
    return formatSalaryIncome(salary);
  }

  if (intent.type === 'SALARY_TRANSACTION_COUNT') {
    const [count, salary] = await Promise.all([
      getSalaryTransactionCount(userId, range),
      getSalaryIncome(userId, range),
    ]);
    return formatSalaryCount(count, range, salary.total);
  }

  if (intent.type === 'CATEGORY_EXPENSE') {
    const category = intent.category || resolveCategory(question, convoCtx);
    if (!category) {
      return 'Which category would you like me to check? For example Food, Rent, or Transport.';
    }
    const amount = await getCategoryExpenses(userId, category, range);
    const budgetRows = await getBudgetStatus(userId, range.monthKey);
    const budgetRow = budgetRows.find((row) => budgetLabel(row.category) === category);
    const budget = budgetRow
      ? {
          amount: budgetRow.amount,
          spent: budgetRow.spent,
          remaining: budgetRow.remaining,
          utilization: budgetRow.utilization,
        }
      : undefined;
    return formatCategoryExpense(category, amount, totals, budget);
  }

  if (intent.type === 'CLARIFICATION') {
    return 'Could you clarify whether you want the total salary amount or the number of salary transactions?';
  }

  return '';
}

export async function runAssistantEngine(
  userId: string,
  question: string,
  history: ChatTurn[],
  engineCtx: EngineContext,
  refDate = new Date()
): Promise<EngineResult> {
  const convoCtx = buildStructuredContext(history, refDate);
  const intent = parseIntents(question, convoCtx, refDate);

  if (intent.type === 'CONVERSATIONAL') {
    const firstName = engineCtx.name.split(' ')[0] || 'there';
    const structured = buildConversationalResponse(intent.kind, firstName);
    return {
      answer: structured.summary,
      confidence: 'high',
      intentType: 'CONVERSATIONAL',
      isConversational: true,
      conversationalKind: intent.kind,
      structuredOverride: structured,
    };
  }

  if (intent.type === 'GREETING') {
    const firstName = engineCtx.name.split(' ')[0] || 'there';
    const structured = buildConversationalResponse('greeting', firstName);
    return {
      answer: structured.summary,
      confidence: 'high',
      intentType: 'GREETING',
      isConversational: true,
      conversationalKind: 'greeting',
      structuredOverride: structured,
    };
  }

  if (intent.type === 'HELP') {
    const firstName = engineCtx.name.split(' ')[0] || 'there';
    const structured = buildConversationalResponse('platform_help', firstName);
    return {
      answer: structured.summary,
      confidence: 'high',
      intentType: 'HELP',
      isConversational: true,
      conversationalKind: 'platform_help',
      structuredOverride: structured,
    };
  }

  if (intent.type === 'GENERAL') {
    const firstName = engineCtx.name.split(' ')[0] || 'there';
    const knowledge = matchKnowledgeQuestion(question);
    if (knowledge) {
      const structured = knowledgeToStructuredResponse(knowledge);
      return {
        answer: structured.summary,
        confidence: 'high',
        intentType: 'FINANCIAL_EDUCATION',
        educationTopic: knowledge.topic,
        isEducation: true,
        structuredOverride: structured,
      };
    }

    if (!isFinanceRelatedQuestion(question)) {
      const structured = buildOffTopicResponse(firstName);
      return {
        answer: structured.summary,
        confidence: 'high',
        intentType: 'GENERAL',
        structuredOverride: structured,
      };
    }

    const structured = buildOpenFinanceGuidance(firstName);
    return {
      answer: structured.summary,
      confidence: 'high',
      intentType: 'GENERAL',
      structuredOverride: structured,
    };
  }

  if (intent.type === 'FINANCIAL_EDUCATION') {
    const knowledge = matchKnowledgeQuestion(question);
    const education = knowledge
      ? knowledgeToStructuredResponse(knowledge)
      : getStaticEducationResponse(intent.topic as EducationTopic);
    return {
      answer: education.summary,
      confidence: 'high',
      intentType: 'FINANCIAL_EDUCATION',
      educationTopic: knowledge?.topic || (intent.topic as EducationTopic),
      isEducation: true,
      structuredOverride: education,
    };
  }

  if (intent.type === 'WHAT_IF') {
    const answer = await executeIntent(intent, userId, question, convoCtx, engineCtx, refDate);
    if (!answer.trim()) {
      return { answer: '', confidence: 'low', intentType: 'WHAT_IF' };
    }
    return { answer, confidence: 'high', intentType: 'WHAT_IF', isWhatIf: true };
  }

  const answer = await executeIntent(intent, userId, question, convoCtx, engineCtx, refDate);

  if (!answer.trim()) {
    return { answer: '', confidence: 'low', intentType: intent.type };
  }

  return { answer, confidence: 'high', intentType: intent.type };
}
