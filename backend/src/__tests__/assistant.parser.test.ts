import { describe, expect, it } from 'vitest';
import { parsePeriod, buildMonthRange, shiftMonth, monthKeyFromDate } from '../modules/assistant/date-parser.js';
import { parseWhatIfScenario } from '../modules/assistant/affordability.service.js';
import { parseIntents } from '../modules/assistant/intent-parser.js';

const refDate = new Date('2026-09-16T12:00:00.000Z');

describe('assistant date parser', () => {
  it('parses August to August 2026 when current month is September 2026', () => {
    const period = parsePeriod('give me a august expense', refDate);
    expect(period?.kind).toBe('single');
    if (period?.kind === 'single') {
      expect(period.range.monthKey).toBe('2026-08');
      expect(period.range.label).toBe('August 2026');
    }
  });

  it('parses last month relative to September 2026', () => {
    const period = parsePeriod('how much did I spend last month', refDate);
    expect(period?.kind).toBe('single');
    if (period?.kind === 'single') {
      expect(period.range.monthKey).toBe('2026-08');
    }
  });

  it('parses this month as September 2026', () => {
    const period = parsePeriod('expenses this month', refDate);
    expect(period?.kind).toBe('single');
    if (period?.kind === 'single') {
      expect(period.range.monthKey).toBe('2026-09');
    }
  });

  it('parses explicit month and year', () => {
    const period = parsePeriod('income in August 2025', refDate);
    expect(period?.kind).toBe('single');
    if (period?.kind === 'single') {
      expect(period.range.monthKey).toBe('2025-08');
    }
  });

  it('parses month comparison', () => {
    const period = parsePeriod('compare August and September expenses', refDate);
    expect(period?.kind).toBe('compare');
    if (period?.kind === 'compare') {
      expect(period.ranges[0].monthKey).toBe('2026-08');
      expect(period.ranges[1].monthKey).toBe('2026-09');
    }
  });
});

describe('assistant intent parser', () => {
  it('detects August expense intent', () => {
    const intent = parseIntents('give me a august expense', {}, refDate);
    expect(intent.type).toBe('TOTAL_EXPENSE');
    if ('period' in intent && intent.period?.kind === 'single') {
      expect(intent.period.range.monthKey).toBe('2026-08');
    }
  });

  it('detects composite August expense and salary count', () => {
    const intent = parseIntents('give me a august expense and how many salary', {}, refDate);
    expect(intent.type).toBe('COMPOSITE');
    if (intent.type === 'COMPOSITE') {
      expect(intent.intents).toHaveLength(2);
      expect(intent.intents[0].type).toBe('TOTAL_EXPENSE');
      expect(intent.intents[1].type).toBe('SALARY_TRANSACTION_COUNT');
      const first = intent.intents[0];
      if ('period' in first && first.period?.kind === 'single') {
        expect(first.period.range.monthKey).toBe('2026-08');
      }
    }
  });

  it('detects salary amount vs salary count', () => {
    const amountIntent = parseIntents('how much salary did I receive in August', {}, refDate);
    expect(amountIntent.type).toBe('SALARY_INCOME');

    const countIntent = parseIntents('how many salary transactions in August', {}, refDate);
    expect(countIntent.type).toBe('SALARY_TRANSACTION_COUNT');
  });

  it('detects category expense', () => {
    const intent = parseIntents('how much did I spend on food in August', {}, refDate);
    expect(intent.type).toBe('CATEGORY_EXPENSE');
    if (intent.type === 'CATEGORY_EXPENSE') {
      expect(intent.category).toBe('Food');
    }
  });

  it('detects top categories intent', () => {
    const intent = parseIntents('where did I spend the most in August', {}, refDate);
    expect(intent.type).toBe('TOP_EXPENSE_CATEGORIES');
  });

  it('detects informal last-month spend-most phrasing', () => {
    const intent = parseIntents('where my last month money used mostly', {}, refDate);
    expect(intent.type).toBe('TOP_EXPENSE_CATEGORIES');
    if ('period' in intent && intent.period?.kind === 'single') {
      expect(intent.period.range.monthKey).toBe('2026-08');
    }
  });

  it('detects financial education intent', () => {
    const intent = parseIntents('What is an emergency fund?', {}, refDate);
    expect(intent.type).toBe('FINANCIAL_EDUCATION');
    if (intent.type === 'FINANCIAL_EDUCATION') {
      expect(intent.topic).toBe('emergency_fund');
    }
  });

  it('detects conversational greeting intent', () => {
    const intent = parseIntents('hello', {}, refDate);
    expect(intent.type).toBe('CONVERSATIONAL');
    if (intent.type === 'CONVERSATIONAL') {
      expect(intent.kind).toBe('greeting');
    }
  });

  it('detects 50/30/20 general finance intent', () => {
    const intent = parseIntents('Explain the 50/30/20 rule', {}, refDate);
    expect(intent.type).toBe('FINANCIAL_EDUCATION');
    if (intent.type === 'FINANCIAL_EDUCATION') {
      expect(intent.topic).toBe('rule_50_30_20');
    }
  });

  it('does not treat personal savings question as education', () => {
    const intent = parseIntents('What is my savings rate this month?', {}, refDate);
    expect(intent.type).not.toBe('FINANCIAL_EDUCATION');
  });

  it('detects why follow-up after expense context', () => {
    const ctx = { lastMonthKey: '2026-08', lastSubject: 'expense' as const, lastIntent: 'TOTAL_EXPENSE' as const };
    const intent = parseIntents('why?', ctx, refDate);
    expect(intent.type).toBe('EXPENSE_CHANGE_WHY');
  });

  it('detects category driver follow-up', () => {
    const ctx = { lastMonthKey: '2026-09', lastSubject: 'expense' as const };
    const intent = parseIntents('Which category caused it?', ctx, refDate);
    expect(intent.type).toBe('CATEGORY_DRIVER');
  });

  it('detects affordability intent', () => {
    const intent = parseIntents('Can I afford a laptop for Rs. 150,000?', {}, refDate);
    expect(intent.type).toBe('WHAT_IF');
    if (intent.type === 'WHAT_IF') {
      expect(intent.scenario.kind).toBe('afford');
      expect(intent.scenario.amount).toBe(150000);
    }
  });

  it('detects what-if spend scenario', () => {
    const intent = parseIntents('What happens if I spend Rs. 50,000?', {}, refDate);
    expect(intent.type).toBe('WHAT_IF');
    if (intent.type === 'WHAT_IF') {
      expect(intent.scenario.kind).toBe('one_time_spend');
      expect(intent.scenario.amount).toBe(50000);
    }
  });

  it('detects what-if income increase scenario', () => {
    const intent = parseIntents('What if my salary increases by 20%?', {}, refDate);
    expect(intent.type).toBe('WHAT_IF');
    if (intent.type === 'WHAT_IF') {
      expect(intent.scenario.kind).toBe('income_change_percent');
      expect(intent.scenario.percent).toBe(20);
    }
  });

  it('detects what-if expense reduction scenario', () => {
    const intent = parseIntents('What if I reduce my expenses by Rs. 10,000?', {}, refDate);
    expect(intent.type).toBe('WHAT_IF');
    if (intent.type === 'WHAT_IF') {
      expect(intent.scenario.kind).toBe('expense_reduce');
      expect(intent.scenario.amount).toBe(10000);
    }
  });

  it('detects what-if monthly savings scenario', () => {
    const intent = parseIntents('What happens if I save Rs. 15,000 every month?', {}, refDate);
    expect(intent.type).toBe('WHAT_IF');
    if (intent.type === 'WHAT_IF') {
      expect(intent.scenario.kind).toBe('monthly_save');
      expect(intent.scenario.amount).toBe(15000);
    }
  });

  it('parses what-if scenarios directly', () => {
    expect(parseWhatIfScenario('Can I afford a laptop for Rs. 150,000?')?.kind).toBe('afford');
    expect(parseWhatIfScenario('What happens if I spend Rs. 50,000?')?.kind).toBe('one_time_spend');
    expect(parseWhatIfScenario('What if my salary increases by 20%?')?.kind).toBe('income_change_percent');
    expect(parseWhatIfScenario('What if I reduce my expenses by Rs. 10,000?')?.kind).toBe('expense_reduce');
    expect(parseWhatIfScenario('What happens if I save Rs. 15,000 every month?')?.kind).toBe('monthly_save');
  });

  it('detects what about last month follow-up for category', () => {
    const ctx = { lastMonthKey: '2026-09', lastCategory: 'Food', lastSubject: 'category' as const };
    const intent = parseIntents('What about last month?', ctx, refDate);
    expect(intent.type).toBe('CATEGORY_EXPENSE');
    if (intent.type === 'CATEGORY_EXPENSE') {
      expect(intent.category).toBe('Food');
      expect(intent.period?.kind).toBe('single');
      if (intent.period?.kind === 'single') {
        expect(intent.period.range.monthKey).toBe('2026-08');
      }
    }
  });
});

describe('month helpers', () => {
  it('shifts months correctly', () => {
    expect(shiftMonth('2026-09', -1)).toBe('2026-08');
    expect(monthKeyFromDate(new Date('2026-09-01T00:00:00.000Z'))).toBe('2026-09');
    expect(buildMonthRange('2026-08').label).toBe('August 2026');
  });
});
