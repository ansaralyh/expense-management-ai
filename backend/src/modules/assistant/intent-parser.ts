import { ParsedPeriod, buildMonthRange, monthKeyFromDate, parsePeriod, shiftMonth } from './date-parser.js';
import { WhatIfScenario, parseWhatIfScenario } from './affordability.service.js';
import { detectEducationTopic } from './financial-education.service.js';
import { matchKnowledgeQuestion } from './assistant-knowledge.js';
import { matchedCategory } from './financial-query.service.js';
import {
  ConversationContext,
  isFollowUpQuestion,
  isShortFollowUp,
  resolveComparisonMonths,
} from './conversation-context.js';

export type ConversationalKind = 'greeting' | 'thanks' | 'farewell' | 'small_talk' | 'platform_help';

export type IntentType =
  | 'GREETING'
  | 'CONVERSATIONAL'
  | 'HELP'
  | 'TOTAL_INCOME'
  | 'TOTAL_EXPENSE'
  | 'NET_SAVINGS'
  | 'CATEGORY_EXPENSE'
  | 'SALARY_INCOME'
  | 'SALARY_TRANSACTION_COUNT'
  | 'TOP_EXPENSE_CATEGORIES'
  | 'LARGEST_EXPENSE'
  | 'MONTHLY_COMPARISON'
  | 'MONTHLY_SUMMARY'
  | 'BUDGET_STATUS'
  | 'SAVINGS_GOAL_STATUS'
  | 'FORECAST'
  | 'FINANCIAL_HEALTH'
  | 'NEED_VS_WANT'
  | 'SPENDING_VS_EARNING'
  | 'COMPOSITE'
  | 'CLARIFICATION'
  | 'FINANCIAL_EDUCATION'
  | 'EXPENSE_CHANGE_WHY'
  | 'SAVINGS_CHANGE_WHY'
  | 'CATEGORY_DRIVER'
  | 'WHAT_IF'
  | 'GENERAL';

export type Intent =
  | {
      type: Exclude<
        IntentType,
        'COMPOSITE' | 'CATEGORY_EXPENSE' | 'MONTHLY_COMPARISON' | 'FINANCIAL_EDUCATION' | 'WHAT_IF' | 'CONVERSATIONAL'
      >;
      period?: ParsedPeriod;
    }
  | { type: 'CONVERSATIONAL'; kind: ConversationalKind }
  | { type: 'CATEGORY_EXPENSE'; category: string; period?: ParsedPeriod }
  | { type: 'MONTHLY_COMPARISON'; period: ParsedPeriod & { kind: 'compare' } }
  | { type: 'FINANCIAL_EDUCATION'; topic: string }
  | { type: 'WHAT_IF'; scenario: WhatIfScenario }
  | { type: 'COMPOSITE'; intents: Intent[] };

function normalize(q: string) {
  return q.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function isGreetingOnly(question: string) {
  return detectConversationalKind(question) === 'greeting';
}

export function detectConversationalKind(question: string): ConversationalKind | null {
  const q = question.trim().toLowerCase();
  if (/^(hi|hello|hey|yo|salam|assalamu alaikum|good morning|good afternoon|good evening)[\s!.,?]*$/i.test(q)) {
    return 'greeting';
  }
  if (/^(thanks|thank you|thx|much appreciated)[\s!.,?]*$/i.test(q)) {
    return 'thanks';
  }
  if (/^(bye|goodbye|see you|good night|goodnight)[\s!.,?]*$/i.test(q)) {
    return 'farewell';
  }
  if (/^(how are you|how're you|how r u|what's up|whats up|how is it going)[\s!.,?]*$/i.test(q)) {
    return 'small_talk';
  }
  if (
    /\b(what can you do|what do you do|how do i use smartfin|how does smartfin work|help me use|platform help)\b/i.test(
      q
    )
  ) {
    return 'platform_help';
  }
  return null;
}

function asksSalaryCount(q: string) {
  return (
    (/\bhow many\b/.test(q) && /\bsalary\b/.test(q)) ||
    (/\bnumber of\b/.test(q) && /\bsalary\b/.test(q)) ||
    (/\bcount\b/.test(q) && /\bsalary\b/.test(q))
  );
}

function asksSalaryAmount(q: string) {
  return (
    (/\bhow much\b/.test(q) && /\bsalary\b/.test(q)) ||
    (/\bsalary\b/.test(q) && /\b(received|receive|earn|earned|income|got|paid)\b/.test(q)) ||
    (/\bsalary\b/.test(q) && !asksSalaryCount(q) && !/\bexpense\b/.test(q) && /\b(how much|total|amount)\b/.test(q))
  );
}

function asksIncome(q: string) {
  return /\b(income|earned|earning|earn|received|receive)\b/.test(q) && !asksSalaryCount(q);
}

function asksExpense(q: string) {
  return /\b(expense|expenses|spent|spending|spend|cost|paid)\b/.test(q);
}

function asksSavings(q: string) {
  return /\b(sav(e|ed|ings)|saved)\b/.test(q);
}

function asksTopCategories(q: string) {
  return (
    /\b(top|highest|biggest|most)\b/.test(q) &&
    (/\bcategor/.test(q) || /\bspend/.test(q) || /\bexpense/.test(q))
  );
}

function asksLargestExpense(q: string) {
  return (
    /\b(largest|biggest|highest)\b/.test(q) &&
    /\b(expense|transaction|purchase|spending)\b/.test(q) &&
    !/\bcategor/.test(q)
  );
}

function asksSpendMost(q: string) {
  return (
    /\b(spend the most|spent the most|where did i spend|most spending)\b/.test(q) ||
    /\b(where|how).*\bmoney\b.*\b(most|mostly)\b/.test(q) ||
    /\b(money used|used mostly|used most)\b/.test(q)
  );
}

function asksBudget(q: string) {
  return /\b(budget|exceed|over budget|overrun)\b/.test(q);
}

function asksGoals(q: string) {
  return /\b(goal|goals|savings goal)\b/.test(q);
}

function asksForecast(q: string) {
  return (
    /\b(forecast|prediction|predict|next month|upcoming month)\b/.test(q) &&
    (/\b(expense|spend|spending|budget|money)\b/.test(q) || /\bnext month\b/.test(q))
  );
}

function asksHealth(q: string) {
  return /\b(health|health score|financial health|score)\b/.test(q);
}

function asksNeedVsWant(q: string) {
  return /\b(need|want)s?\b/.test(q) && /\b(vs|versus|against|split|share|percent)\b/.test(q);
}

function asksSpendingVsEarning(q: string) {
  return asksIncome(q) && asksExpense(q) && !matchedCategory(q) && !asksSalaryCount(q);
}

function asksMonthlySummary(q: string) {
  return (
    /\b(summary|overview|breakdown)\b/.test(q) ||
    (asksIncome(q) && asksExpense(q) && asksSavings(q))
  );
}

function asksComparison(q: string, refDate: Date): ParsedPeriod | null {
  const period = parsePeriod(q, refDate);
  if (period?.kind === 'compare') return period;
  return null;
}

function detectSingleIntent(q: string, refDate: Date, ctx: ConversationContext): Intent | null {
  const category = matchedCategory(q);
  const period = parsePeriod(q, refDate, ctx.lastMonthKey) || undefined;

  if (asksSalaryCount(q)) {
    return { type: 'SALARY_TRANSACTION_COUNT', period };
  }

  if (asksSalaryAmount(q)) {
    return { type: 'SALARY_INCOME', period };
  }

  if (asksSpendMost(q) || asksTopCategories(q)) {
    return { type: 'TOP_EXPENSE_CATEGORIES', period };
  }

  if (asksLargestExpense(q)) {
    return { type: 'LARGEST_EXPENSE', period };
  }

  if (category && (asksExpense(q) || /\bhow much\b/.test(q) || isFollowUpQuestion(q))) {
    return { type: 'CATEGORY_EXPENSE', category, period };
  }

  if (asksNeedVsWant(q)) {
    return { type: 'NEED_VS_WANT', period };
  }

  if (asksSavings(q) && !asksForecast(q)) {
    return { type: 'NET_SAVINGS', period };
  }

  if (asksMonthlySummary(q)) {
    return { type: 'MONTHLY_SUMMARY', period };
  }

  if (asksIncome(q) && !asksExpense(q)) {
    return { type: 'TOTAL_INCOME', period };
  }

  if (asksExpense(q) && !asksIncome(q)) {
    return { type: 'TOTAL_EXPENSE', period };
  }

  if (/\bgive me\b/.test(q) && /\bexpense/.test(q)) {
    return { type: 'TOTAL_EXPENSE', period };
  }

  if (/\bgive me\b/.test(q) && /\bincome\b/.test(q)) {
    return { type: 'TOTAL_INCOME', period };
  }

  if (asksSpendingVsEarning(q)) {
    return { type: 'SPENDING_VS_EARNING', period };
  }

  if (asksBudget(q)) {
    return { type: 'BUDGET_STATUS', period };
  }

  if (asksGoals(q)) {
    return { type: 'SAVINGS_GOAL_STATUS' };
  }

  if (asksForecast(q)) {
    return { type: 'FORECAST' };
  }

  if (asksHealth(q)) {
    return { type: 'FINANCIAL_HEALTH' };
  }

  return null;
}

function detectFollowUpIntent(question: string, ctx: ConversationContext, refDate: Date): Intent | null {
  const q = normalize(question);
  const trimmed = question.trim();

  if (!isFollowUpQuestion(question) && !isShortFollowUp(question)) {
    return null;
  }

  if (/^why\??$/i.test(trimmed) || /\bwhy did (my )?(spending|expenses|it)\b/.test(q)) {
    if (ctx.lastSubject === 'savings' || ctx.lastIntent === 'NET_SAVINGS') {
      const monthKey = ctx.lastMonthKey || monthKeyFromDate(refDate);
      return {
        type: 'SAVINGS_CHANGE_WHY',
        period: { kind: 'single', range: buildMonthRange(monthKey) },
      };
    }
    const monthKey = ctx.lastMonthKey || monthKeyFromDate(refDate);
    return {
      type: 'EXPENSE_CHANGE_WHY',
      period: { kind: 'single', range: buildMonthRange(monthKey) },
    };
  }

  if (/\b(which category|what category|category caused|caused it|caused that|biggest driver)\b/.test(q)) {
    const monthKey = ctx.lastMonthKey || monthKeyFromDate(refDate);
    return {
      type: 'CATEGORY_DRIVER',
      period: { kind: 'single', range: buildMonthRange(monthKey) },
    };
  }

  if (/^what about (last|previous) month/i.test(trimmed) || /^and (last|previous) month/i.test(trimmed)) {
    const anchor = ctx.lastMonthKey || monthKeyFromDate(refDate);
    const targetMonth = shiftMonth(anchor, -1);
    const period = { kind: 'single' as const, range: buildMonthRange(targetMonth) };

    if (ctx.lastCategory) {
      return { type: 'CATEGORY_EXPENSE', category: ctx.lastCategory, period };
    }
    if (ctx.lastSubject === 'income' || ctx.lastIntent === 'TOTAL_INCOME' || ctx.lastIntent === 'SALARY_INCOME') {
      return { type: 'TOTAL_INCOME', period };
    }
    if (ctx.lastSubject === 'savings' || ctx.lastIntent === 'NET_SAVINGS') {
      return { type: 'NET_SAVINGS', period };
    }
    return { type: 'TOTAL_EXPENSE', period };
  }

  if (/^what about this month/i.test(trimmed) && ctx.lastCategory) {
    const monthKey = monthKeyFromDate(refDate);
    return {
      type: 'CATEGORY_EXPENSE',
      category: ctx.lastCategory,
      period: { kind: 'single', range: buildMonthRange(monthKey) },
    };
  }

  const compareMonths = resolveComparisonMonths(question, ctx, refDate);
  if (compareMonths) {
    return {
      type: 'MONTHLY_COMPARISON',
      period: {
        kind: 'compare',
        ranges: [buildMonthRange(compareMonths[0]), buildMonthRange(compareMonths[1])],
      },
    };
  }

  if (ctx.lastCategory && (isShortFollowUp(question) || /^what about (it|that)\??$/i.test(trimmed))) {
    const monthKey = ctx.lastMonthKey || monthKeyFromDate(refDate);
    return {
      type: 'CATEGORY_EXPENSE',
      category: ctx.lastCategory,
      period: { kind: 'single', range: buildMonthRange(monthKey) },
    };
  }

  return null;
}

function splitCompositeQuestion(question: string): string[] {
  const parts = question
    .split(/\band also\b|\band\b|,|\?/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [question];
  return parts;
}

export function parseIntents(
  question: string,
  ctx: ConversationContext,
  refDate = new Date()
): Intent {
  const q = normalize(question);

  const conversational = detectConversationalKind(question);
  if (conversational) {
    return { type: 'CONVERSATIONAL', kind: conversational };
  }

  if (/\b(help|what can you|what do you|how do you)\b/.test(q)) {
    return { type: 'HELP' };
  }

  const whatIfScenario = parseWhatIfScenario(question);
  if (whatIfScenario) {
    return { type: 'WHAT_IF', scenario: whatIfScenario };
  }

  const knowledgeMatch = matchKnowledgeQuestion(question);
  if (knowledgeMatch) {
    return { type: 'FINANCIAL_EDUCATION', topic: knowledgeMatch.topic };
  }

  const educationTopic = detectEducationTopic(question);
  if (educationTopic) {
    return { type: 'FINANCIAL_EDUCATION', topic: educationTopic };
  }

  const followUp = detectFollowUpIntent(question, ctx, refDate);
  if (followUp) {
    return followUp;
  }

  const comparison = asksComparison(q, refDate);
  if (comparison?.kind === 'compare') {
    return { type: 'MONTHLY_COMPARISON', period: comparison };
  }

  const parts = splitCompositeQuestion(question);
  if (parts.length > 1) {
    const sharedPeriod = parsePeriod(question, refDate, ctx.lastMonthKey) || undefined;
    const intents: Intent[] = [];
    for (const part of parts) {
      const intent = detectSingleIntent(normalize(part), refDate, ctx);
      if (intent && intent.type !== 'COMPOSITE') {
        if (sharedPeriod?.kind === 'single' && !('period' in intent && intent.period)) {
          (intent as Intent & { period?: ParsedPeriod }).period = sharedPeriod;
        }
        intents.push(intent);
      }
    }
    if (intents.length > 1) {
      return { type: 'COMPOSITE', intents };
    }
    if (intents.length === 1) {
      return intents[0];
    }
  }

  const single = detectSingleIntent(q, refDate, ctx);
  if (single) return single;

  // Loose expense/income detection for informal phrasing
  if (/\bexpense/.test(q)) {
    return { type: 'TOTAL_EXPENSE', period: parsePeriod(q, refDate, ctx.lastMonthKey) || undefined };
  }

  if (/\bsalary\b/.test(q)) {
    if (asksSalaryCount(q)) {
      return { type: 'SALARY_TRANSACTION_COUNT', period: parsePeriod(q, refDate, ctx.lastMonthKey) || undefined };
    }
    return { type: 'SALARY_INCOME', period: parsePeriod(q, refDate, ctx.lastMonthKey) || undefined };
  }

  if (/\bincome\b/.test(q)) {
    return { type: 'TOTAL_INCOME', period: parsePeriod(q, refDate, ctx.lastMonthKey) || undefined };
  }

  return { type: 'GENERAL' };
}
