import { StructuredAIResponse } from './ai-provider.js';
import { getKnowledgeByTopic, knowledgeToStructuredResponse } from './assistant-knowledge.js';

export type EducationTopic =
  | 'emergency_fund'
  | 'net_worth'
  | 'savings_rate'
  | 'compound_interest'
  | 'needs_vs_wants'
  | 'budgeting'
  | 'debt_to_income'
  | 'general';

const EDUCATION_TOPICS: { topic: EducationTopic; patterns: RegExp[] }[] = [
  {
    topic: 'emergency_fund',
    patterns: [/\bemergency fund\b/i],
  },
  {
    topic: 'net_worth',
    patterns: [/\bnet worth\b/i],
  },
  {
    topic: 'savings_rate',
    patterns: [/\bsavings rate\b/i],
  },
  {
    topic: 'compound_interest',
    patterns: [/\bcompound interest\b/i],
  },
  {
    topic: 'needs_vs_wants',
    patterns: [
      /\bneeds?\s+(and|vs\.?|versus)\s+wants?\b/i,
      /\bdifference between needs and wants\b/i,
    ],
  },
  {
    topic: 'budgeting',
    patterns: [/\bbudgeting\b/i, /\bhow (does|do) budget/i, /\bhow budgets work\b/i],
  },
  {
    topic: 'debt_to_income',
    patterns: [/\bdebt[- ]to[- ]income\b/i, /\bdti ratio\b/i],
  },
];

const STATIC_ANSWERS: Record<EducationTopic, { title: string; summary: string; evidence: string[]; recommendation: string }> = {
  emergency_fund: {
    title: 'Financial Education — Emergency Fund',
    summary:
      'An emergency fund is cash set aside to cover unexpected expenses such as medical bills, job loss, or urgent repairs — without relying on debt.',
    evidence: [
      'General rule: keep 3–6 months of essential living expenses in a liquid account.',
      'This is general financial knowledge, not your personal SmartFin balance.',
    ],
    recommendation:
      'Start with a small monthly transfer to a separate savings account until you reach one month of expenses, then build toward 3–6 months.',
  },
  net_worth: {
    title: 'Financial Education — Net Worth',
    summary:
      'Net worth is the difference between everything you own (assets) and everything you owe (liabilities). Net Worth = Total Assets − Total Liabilities.',
    evidence: [
      'Assets include cash, savings, investments, and property.',
      'Liabilities include loans, credit card balances, and other debts.',
      'This definition is general — ask about your records for your actual net worth in SmartFin.',
    ],
    recommendation: 'Track assets and liabilities monthly on the Net Worth page to see progress over time.',
  },
  savings_rate: {
    title: 'Financial Education — Savings Rate',
    summary:
      'Savings rate is the percentage of your income that you keep after expenses. Formula: Savings Rate = (Income − Expenses) ÷ Income × 100.',
    evidence: [
      'Example: Rs. 100,000 income and Rs. 70,000 expenses → 30% savings rate.',
      'A common target is 20% or higher, depending on your goals.',
    ],
    recommendation: 'Ask me "Give me a monthly financial summary" to see your actual savings rate from your SmartFin records.',
  },
  compound_interest: {
    title: 'Financial Education — Compound Interest',
    summary:
      'Compound interest is interest earned on both your original amount and on interest already accumulated — your money grows faster over time.',
    evidence: [
      'Formula concept: Future Value ≈ Principal × (1 + rate)^time.',
      'Starting early and reinvesting returns makes compounding more powerful.',
    ],
    recommendation: 'Use Savings Goals in SmartFin to plan long-term targets and review progress regularly.',
  },
  needs_vs_wants: {
    title: 'Financial Education — Needs vs Wants',
    summary:
      'Needs are essential costs required to live and work (rent, utilities, groceries, transport). Wants are optional spending (dining out, entertainment, upgrades).',
    evidence: [
      'Separating needs and wants helps prioritize budgets during tight months.',
      'SmartFin tags expenses as NEED or WANT when you record them.',
    ],
    recommendation: 'Ask "Need vs want split this month" to see your personal breakdown from your records.',
  },
  budgeting: {
    title: 'Financial Education — Budgeting',
    summary:
      'Budgeting is planning how you will allocate income across categories before you spend, then tracking actual spending against those limits.',
    evidence: [
      'Typical steps: list income → set category limits → record expenses → review variance monthly.',
      'Zero-based budgeting assigns every rupee a job before the month starts.',
    ],
    recommendation: 'Set monthly budgets on the Budgets page, then ask me about budget status for your live data.',
  },
  debt_to_income: {
    title: 'Financial Education — Debt-to-Income Ratio',
    summary:
      'Debt-to-income (DTI) ratio compares your total monthly debt payments to your gross monthly income. DTI = Monthly Debt Payments ÷ Monthly Income × 100.',
    evidence: [
      'Lenders often prefer DTI below 36–40%, though guidelines vary.',
      'Lower DTI means more room for savings and unexpected costs.',
    ],
    recommendation: 'Track loans on Debt & Loans and ask about your spending and income trends in SmartFin.',
  },
  general: {
    title: 'Financial Education',
    summary:
      'I can explain general personal finance concepts such as emergency funds, net worth, savings rate, budgeting, and compound interest.',
    evidence: [
      'Educational answers are general knowledge and do not use your private SmartFin records.',
      'For personal numbers, ask about your income, expenses, budgets, or savings.',
    ],
    recommendation:
      'Try "What is an emergency fund?" for education, or "Give me a monthly financial summary" for your live data.',
  },
};

function asksForPersonalData(q: string) {
  return /\b(my|mine|how much did i|did i|show my|what is my|what's my|how much have i|i spent|i saved|i earn)\b/i.test(
    q
  );
}

function asksEducationalFraming(q: string) {
  return (
    /^(what is|what's|explain|define|tell me about|how does|how do|what does)\b/i.test(q.trim()) ||
    /\b(difference between|meaning of|concept of)\b/i.test(q)
  );
}

export function detectEducationTopic(question: string): EducationTopic | null {
  const q = question.trim();
  if (!asksEducationalFraming(q) && !EDUCATION_TOPICS.some((row) => row.patterns.some((p) => p.test(q)))) {
    return null;
  }
  if (asksForPersonalData(q)) {
    return null;
  }

  for (const row of EDUCATION_TOPICS) {
    if (row.patterns.some((pattern) => pattern.test(q))) {
      return row.topic;
    }
  }

  if (asksEducationalFraming(q)) {
    return 'general';
  }

  return null;
}

export function getStaticEducationResponse(topic: EducationTopic | string): StructuredAIResponse {
  const knowledgeEntry = getKnowledgeByTopic(topic);
  if (knowledgeEntry) {
    return knowledgeToStructuredResponse(knowledgeEntry);
  }

  const content = STATIC_ANSWERS[topic as EducationTopic] || STATIC_ANSWERS.general;
  return {
    title: content.title,
    summary: content.summary,
    evidence: content.evidence,
    recommendation: content.recommendation,
    source: 'Financial Education',
  };
}

export async function generateEducationWithLlm(
  question: string,
  topic: EducationTopic | string
): Promise<StructuredAIResponse | null> {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';
  if (!apiKey.trim()) return null;

  const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
  const knowledgeEntry = getKnowledgeByTopic(topic);
  const legacyTopic = topic as EducationTopic;
  const staticHint =
    knowledgeEntry?.summary || STATIC_ANSWERS[legacyTopic]?.summary || STATIC_ANSWERS.general.summary;
  const staticFallback = STATIC_ANSWERS[legacyTopic] || STATIC_ANSWERS.general;

  const systemPrompt = `You are SmartFin Financial Education assistant.
Answer general personal finance and SmartFin feature questions clearly in 2-4 sentences.
Return JSON ONLY:
{"title":"...","summary":"...","evidence":["..."],"recommendation":"..."}

RULES:
- Provide GENERAL financial education only — never invent the user's personal balances or transactions.
- Be conversational and helpful; do not refuse broad finance questions.
- Use Rs. when giving numeric examples.
- Keep JSON valid without markdown.`;

  const userPrompt = `Topic hint: ${topic}
Reference explanation: ${staticHint}
User question: ${question}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as {
      title?: string;
      summary?: string;
      evidence?: string[];
      recommendation?: string;
    };

    return {
      title: parsed.title || knowledgeEntry?.title || staticFallback.title,
      summary: parsed.summary || knowledgeEntry?.summary || staticFallback.summary,
      evidence: Array.isArray(parsed.evidence)
        ? [...parsed.evidence, 'This is general financial education — not your personal SmartFin data.']
        : ['This is general financial education — not your personal SmartFin data.'],
      recommendation: parsed.recommendation || knowledgeEntry?.recommendation || staticFallback.recommendation,
      source: `Financial Education (${model})`,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function buildEducationResponse(question: string, topic: EducationTopic | string): Promise<StructuredAIResponse> {
  const llm = await generateEducationWithLlm(question, topic);
  if (llm) return llm;
  return getStaticEducationResponse(topic);
}
