import { StructuredAIResponse } from './ai-provider.js';

export type KnowledgeTopic =
  | 'rule_50_30_20'
  | 'emergency_fund'
  | 'savings_rate'
  | 'net_worth'
  | 'compound_interest'
  | 'needs_vs_wants'
  | 'budgeting'
  | 'zero_based_budget'
  | 'debt_snowball'
  | 'debt_avalanche'
  | 'debt_to_income'
  | 'inflation'
  | 'investment_basics'
  | 'mutual_funds'
  | 'tax_basics'
  | 'zakat_basics'
  | 'smartfin_overview'
  | 'smartfin_import'
  | 'smartfin_budgets'
  | 'smartfin_anomalies'
  | 'smartfin_predictions'
  | 'smartfin_health_score'
  | 'smartfin_receipt_scan';

type KnowledgeEntry = {
  topic: KnowledgeTopic;
  patterns: RegExp[];
  title: string;
  summary: string;
  evidence: string[];
  recommendation: string;
  action?: { label: string; href: string };
};

const KNOWLEDGE_ENTRIES: KnowledgeEntry[] = [
  {
    topic: 'rule_50_30_20',
    patterns: [/\b50\s*[\/\-]\s*30\s*[\/\-]\s*20\b/i, /\bfifty.thirty.twenty\b/i, /\b50 30 20 rule\b/i],
    title: 'The 50/30/20 Rule',
    summary:
      'The 50/30/20 rule splits after-tax income into three buckets: about 50% for needs (rent, groceries, utilities), 30% for wants (dining, entertainment), and 20% for savings and debt payoff.',
    evidence: [
      'Needs = essential living costs you cannot easily skip.',
      'Wants = flexible lifestyle spending you can trim in tight months.',
      'Savings/debt = building emergency funds, goals, and reducing high-interest debt.',
    ],
    recommendation:
      'Compare your SmartFin Need vs Want split and savings rate to see how close you are to this guideline.',
    action: { label: 'Open Analytics', href: '/analytics' },
  },
  {
    topic: 'emergency_fund',
    patterns: [/\bemergency fund\b/i, /\brainy day fund\b/i],
    title: 'Emergency Fund',
    summary:
      'An emergency fund is cash reserved for unexpected events — job loss, medical bills, or urgent repairs — so you do not need expensive debt.',
    evidence: [
      'Common target: 3–6 months of essential monthly expenses.',
      'Keep it liquid (savings account) and separate from everyday spending.',
    ],
    recommendation: 'Automate a small monthly transfer until you reach one month of expenses, then build toward 3–6 months.',
    action: { label: 'Set a Savings Goal', href: '/savings-goals' },
  },
  {
    topic: 'savings_rate',
    patterns: [/\bsavings rate\b/i],
    title: 'Savings Rate',
    summary:
      'Savings rate is the percentage of income retained after expenses: (Income − Expenses) ÷ Income × 100. Many planners target 20% or more when possible.',
    evidence: [
      'Example: Rs. 100,000 income and Rs. 70,000 expenses → 30% savings rate.',
      'A negative rate means spending exceeded income that period.',
    ],
    recommendation: 'Ask "Give me a monthly financial summary" to see your live savings rate from SmartFin.',
    action: { label: 'View Dashboard', href: '/dashboard' },
  },
  {
    topic: 'net_worth',
    patterns: [/\bnet worth\b/i],
    title: 'Net Worth',
    summary: 'Net worth = Total Assets − Total Liabilities. It shows overall financial progress beyond monthly cash flow.',
    evidence: [
      'Assets: cash, savings, investments, property.',
      'Liabilities: loans, credit cards, other debts.',
    ],
    recommendation: 'Track assets and liabilities on the Net Worth page and review monthly.',
    action: { label: 'Open Net Worth', href: '/networth' },
  },
  {
    topic: 'compound_interest',
    patterns: [/\bcompound interest\b/i],
    title: 'Compound Interest',
    summary:
      'Compound interest is growth on both principal and previously earned interest. Starting early and staying consistent makes it powerful over long horizons.',
    evidence: ['Concept: Future Value ≈ Principal × (1 + rate)^time.', 'Reinvesting returns accelerates long-term wealth building.'],
    recommendation: 'Use Savings Goals to model long-term targets and review progress regularly.',
    action: { label: 'Savings Goals', href: '/savings-goals' },
  },
  {
    topic: 'needs_vs_wants',
    patterns: [
      /\bneeds?\s+(and|vs\.?|versus)\s+wants?\b/i,
      /\bdifference between needs and wants\b/i,
    ],
    title: 'Needs vs Wants',
    summary:
      'Needs are essentials (rent, utilities, groceries, transport). Wants are optional (dining out, subscriptions, upgrades). Splitting them improves budgeting decisions.',
    evidence: ['SmartFin tags expenses as NEED or WANT when you record them.', 'During tight months, trim wants first while protecting needs.'],
    recommendation: 'Ask "Need vs want split this month" for your personal breakdown.',
    action: { label: 'View Expenses', href: '/expenses' },
  },
  {
    topic: 'budgeting',
    patterns: [/\bbudgeting\b/i, /\bhow (does|do) budget/i, /\bmonthly budget\b/i, /\bcreate a budget\b/i],
    title: 'Budgeting Basics',
    summary:
      'Budgeting assigns expected income to categories before you spend, then compares actual spending to those limits each month.',
    evidence: [
      'Steps: list income → set category limits → track expenses → review variance.',
      'Category budgets help catch overspend early instead of at month-end.',
    ],
    recommendation: 'Set limits on the Budgets page, then ask about budget status for live utilization.',
    action: { label: 'Open Budgets', href: '/budgets' },
  },
  {
    topic: 'zero_based_budget',
    patterns: [/\bzero[- ]based budget/i],
    title: 'Zero-Based Budgeting',
    summary:
      'Zero-based budgeting assigns every rupee of income a job (needs, wants, savings, debt) so planned allocations equal income with nothing left unassigned.',
    evidence: ['Forces intentional trade-offs before spending.', 'Works well when income is stable and categories are tracked consistently.'],
    recommendation: 'Start with an overall monthly cap in SmartFin, then add category budgets for your largest spend areas.',
    action: { label: 'Set Budgets', href: '/budgets' },
  },
  {
    topic: 'debt_snowball',
    patterns: [/\bdebt snowball\b/i, /\bsnowball method\b/i],
    title: 'Debt Snowball Method',
    summary:
      'Pay minimums on all debts, then put extra cash toward the smallest balance first. Quick wins build momentum and free up cash flow.',
    evidence: ['Psychological momentum from closing accounts faster.', 'Best when motivation matters more than pure math optimization.'],
    recommendation: 'List debts on Debt & Loans and track payoff order alongside your monthly surplus.',
    action: { label: 'Debt & Loans', href: '/debts' },
  },
  {
    topic: 'debt_avalanche',
    patterns: [/\bdebt avalanche\b/i, /\bavalanche method\b/i],
    title: 'Debt Avalanche Method',
    summary:
      'Pay minimums on all debts, then attack the highest interest rate balance first. This minimizes total interest paid over time.',
    evidence: ['Mathematically efficient for high-interest credit card or personal loan debt.', 'Requires patience if the highest-rate balance is also large.'],
    recommendation: 'Compare interest rates on Debt & Loans and align extra payments with your chosen strategy.',
    action: { label: 'Debt & Loans', href: '/debts' },
  },
  {
    topic: 'debt_to_income',
    patterns: [/\bdebt[- ]to[- ]income\b/i, /\bdti ratio\b/i],
    title: 'Debt-to-Income Ratio',
    summary: 'DTI = Monthly Debt Payments ÷ Gross Monthly Income × 100. It shows how much income is committed to debt servicing.',
    evidence: ['Many lenders prefer DTI below 36–40%, though rules vary.', 'Lower DTI leaves more room for savings and emergencies.'],
    recommendation: 'Track loans in SmartFin and monitor whether your surplus income is growing month to month.',
    action: { label: 'Debt & Loans', href: '/debts' },
  },
  {
    topic: 'inflation',
    patterns: [/\binflation\b/i, /\brising prices\b/i, /\bpurchasing power\b/i],
    title: 'Inflation Basics',
    summary:
      'Inflation is the gradual rise in prices over time, which reduces purchasing power. Cash sitting idle loses real value; planned saving and investing aim to outpace inflation.',
    evidence: [
      'Essential costs (rent, food, utilities) often rise faster than discretionary items.',
      'Emergency funds should be reviewed as living costs increase.',
    ],
    recommendation: 'Review recurring bills in SmartFin and adjust category budgets when essential costs climb.',
    action: { label: 'Bills & Recurring', href: '/recurring' },
  },
  {
    topic: 'investment_basics',
    patterns: [
      /\binvest(ment|ing)?\b/i,
      /\bstock market\b/i,
      /\bportfolio\b/i,
      /\bdiversif/i,
    ],
    title: 'Investment Basics',
    summary:
      'Investing puts money into assets (stocks, bonds, funds, property) expected to grow over time. Diversification spreads risk across assets rather than relying on one bet.',
    evidence: [
      'Higher potential return usually comes with higher short-term volatility.',
      'A solid emergency fund and manageable debt typically come before aggressive investing.',
    ],
    recommendation: 'Know your monthly surplus first — ask for a financial summary, then decide how much is available to invest.',
    action: { label: 'View Dashboard', href: '/dashboard' },
  },
  {
    topic: 'mutual_funds',
    patterns: [/\bmutual fund\b/i, /\bindex fund\b/i, /\betf\b/i],
    title: 'Mutual Funds & Index Funds',
    summary:
      'Mutual funds pool money from many investors into a managed basket of assets. Index funds passively track a market index and often have lower fees than actively managed funds.',
    evidence: ['Fees (expense ratio) materially affect long-term returns.', 'Match fund risk to your time horizon and comfort with volatility.'],
    recommendation: 'This is general education — consult a licensed advisor for product-specific advice in your market.',
  },
  {
    topic: 'tax_basics',
    patterns: [/\btax(es|ation)?\b/i, /\bincome tax\b/i, /\btax bracket\b/i, /\btax planning\b/i],
    title: 'Tax Planning Basics',
    summary:
      'Tax planning organizes income, deductions, and timing so you meet legal obligations efficiently. Effective rates depend on income slabs, allowances, and applicable rules in your jurisdiction.',
    evidence: [
      'Keep records of salary, business income, and deductible expenses.',
      'SmartFin Tax & Zakat tools help estimate and organize — not replace professional tax advice.',
    ],
    recommendation: 'Use Tax & Zakat for estimates, and consult a qualified tax professional for filing decisions.',
    action: { label: 'Tax & Zakat', href: '/tax-planner' },
  },
  {
    topic: 'zakat_basics',
    patterns: [/\bzakat\b/i, /\bnisab\b/i],
    title: 'Zakat Basics',
    summary:
      'Zakat is a calculated charitable obligation on qualifying wealth held for a lunar year, subject to nisab thresholds and asset rules in Islamic jurisprudence.',
    evidence: ['Amount depends on eligible assets, debts, and applicable madhab guidance.', 'SmartFin provides planning helpers — verify with a scholar for your situation.'],
    recommendation: 'Open Tax & Zakat to review estimates alongside your recorded assets and cash flow.',
    action: { label: 'Tax & Zakat', href: '/tax-planner' },
  },
  {
    topic: 'smartfin_overview',
    patterns: [
      /\bwhat (can|does) smartfin\b/i,
      /\bwhat (can|do) you do\b/i,
      /\bhow (does|do) (smartfin|this app|this platform) work\b/i,
      /\bplatform features\b/i,
      /\bfeatures of smartfin\b/i,
    ],
    title: 'SmartFin Overview',
    summary:
      'SmartFin tracks income and expenses, sets budgets and savings goals, scans receipts, imports spreadsheets, detects unusual spending, forecasts expenses, and scores financial health — all from your live ledger.',
    evidence: [
      'Dashboard: monthly income, expenses, savings, and trends.',
      'AI Copilot: ask about your data or general finance concepts.',
      'Tools: Budgets, Predictions, Anomalies, Reports, and Financial Health.',
    ],
    recommendation: 'Start by adding income and expenses, then explore Dashboard and Budgets.',
    action: { label: 'Go to Dashboard', href: '/dashboard' },
  },
  {
    topic: 'smartfin_import',
    patterns: [/\bimport\b/i, /\bupload excel\b/i, /\bupload csv\b/i, /\bspreadsheet\b/i],
    title: 'Importing Data',
    summary:
      'Use Import Excel to bulk-upload income and expense rows from .xlsx or .csv templates. Preview locally, validate headers, then send to update your ledger.',
    evidence: ['Templates include required columns for income and expense sheets.', 'Max file size is 5 MB.'],
    recommendation: 'Download the template first, fill your rows, then upload on the Import page.',
    action: { label: 'Import Excel', href: '/import' },
  },
  {
    topic: 'smartfin_budgets',
    patterns: [/\bhow (to|do i) (set|create|use) budget/i, /\bbudget page\b/i],
    title: 'Using Budgets in SmartFin',
    summary:
      'Set overall or category budgets on the Budgets page. SmartFin tracks spent vs limit and flags utilization above 100%.',
    evidence: ['Ask the copilot "How is my budget?" for live status.', 'Pair budgets with Need vs Want tags to prioritize cuts.'],
    recommendation: 'Create an overall monthly cap first, then add limits for your top three categories.',
    action: { label: 'Open Budgets', href: '/budgets' },
  },
  {
    topic: 'smartfin_anomalies',
    patterns: [/\banomal/i, /\bunusual spend/i, /\bunusual expense/i, /\boutlier\b/i],
    title: 'Anomaly Detection',
    summary:
      'SmartFin flags expenses that look unusually large compared to your normal pattern in the same category, helping you spot errors or one-off spikes.',
    evidence: ['Requires enough expense history to establish a baseline.', 'Review unresolved alerts on the Anomalies page.'],
    recommendation: 'Ask "Find unusual spending" or open Anomalies after logging several months of expenses.',
    action: { label: 'View Anomalies', href: '/anomalies' },
  },
  {
    topic: 'smartfin_predictions',
    patterns: [/\bpredict(ion|ions)?\b/i, /\bforecast\b/i, /\bml model\b/i],
    title: 'Expense Predictions',
    summary:
      'The Predictions module trains on your expense history to estimate next-month spending by category. More months of data improve accuracy.',
    evidence: ['Train the model on the Predictions page after at least 3 months of expenses.', 'Ask "What is my expense forecast?" for the latest result.'],
    recommendation: 'Keep logging expenses consistently, then retrain monthly.',
    action: { label: 'Open Predictions', href: '/predictions' },
  },
  {
    topic: 'smartfin_health_score',
    patterns: [/\bhealth score\b/i, /\bfinancial health\b/i, /\bscore out of 100\b/i],
    title: 'Financial Health Score',
    summary:
      'SmartFin scores you 0–100 using savings rate, budget adherence, expense stability, emergency fund progress, and goal progress — with plain-language recommendations.',
    evidence: ['Status bands: At Risk, Moderate, Good, Excellent.', 'Negative monthly savings typically lowers the savings-rate component.'],
    recommendation: 'Open Financial Health for component breakdowns and targeted tips.',
    action: { label: 'Financial Health', href: '/financial-health' },
  },
  {
    topic: 'smartfin_receipt_scan',
    patterns: [/\bscan receipt\b/i, /\breceipt scanner\b/i, /\bupload receipt\b/i, /\bcamera\b/i],
    title: 'Receipt Scanner',
    summary:
      'Scan or upload receipt images, PDFs, Excel, or CSV files (up to 5 MB) to extract amount, date, and merchant details into expense entries.',
    evidence: ['Camera capture and file upload are both supported.', 'Review extracted fields before saving.'],
    recommendation: 'Use the scanner after shopping to keep categories accurate without manual typing.',
    action: { label: 'Scan Receipt', href: '/expenses/scan' },
  },
];

export const ASSISTANT_SYSTEM_KNOWLEDGE = `SmartFin AI Copilot knowledge (general education — do NOT invent user-specific numbers):

Personal Finance:
- 50/30/20 rule: ~50% needs, 30% wants, 20% savings/debt.
- Emergency fund: 3–6 months of essential expenses in liquid savings.
- Savings rate: (Income − Expenses) / Income × 100; target often ≥20%.
- Needs vs wants: essentials vs discretionary; trim wants first when cash is tight.
- Debt snowball: smallest balance first for momentum. Debt avalanche: highest interest first for math efficiency.
- DTI: monthly debt payments / gross monthly income × 100; lower is healthier.
- Inflation erodes purchasing power; revisit budgets as living costs rise.
- Investing basics: diversify, match risk to horizon, fund emergencies before aggressive risk.

SmartFin features:
- Dashboard: live income, expenses, savings, trends.
- Import Excel/CSV bulk upload with preview and validation.
- Budgets: overall and category limits with utilization tracking.
- Anomalies: flags unusual expenses vs category norms.
- Predictions: ML forecast of next-month spending (needs history).
- Financial Health: 0–100 score from savings, budgets, stability, emergency fund, goals.
- Receipt scan: camera or file upload for expense capture.
- Tax & Zakat: planning helpers (not professional tax advice).

Behavior:
- Greet warmly; never refuse casual conversation.
- Use live ledger ONLY when the question asks for personal data (my, I spent, this month, etc.).
- For general concepts, teach clearly without fabricating the user's balances.
- Off-topic: politely redirect to finance and SmartFin tools.`;

function asksForPersonalData(q: string) {
  return /\b(my|mine|how much did i|did i|show my|what is my|what's my|how much have i|i spent|i saved|i earn|this month|last month)\b/i.test(
    q
  );
}

export function isFinanceRelatedQuestion(question: string) {
  const q = question.toLowerCase();
  return (
    /\b(finance|financial|money|budget|save|saving|debt|loan|invest|tax|zakat|income|expense|spend|cash|emergency|inflation|afford|goal|smartfin|ledger|receipt|anomal|forecast|predict)\b/i.test(
      q
    ) || KNOWLEDGE_ENTRIES.some((entry) => entry.patterns.some((p) => p.test(q)))
  );
}

export function getKnowledgeByTopic(topic: string): KnowledgeEntry | undefined {
  return KNOWLEDGE_ENTRIES.find((entry) => entry.topic === topic);
}

export function matchKnowledgeQuestion(question: string): KnowledgeEntry | null {
  const q = question.trim();
  if (asksForPersonalData(q)) return null;

  for (const entry of KNOWLEDGE_ENTRIES) {
    if (entry.patterns.some((pattern) => pattern.test(q))) {
      return entry;
    }
  }
  return null;
}

export function knowledgeToStructuredResponse(entry: KnowledgeEntry): StructuredAIResponse {
  return {
    title: entry.title,
    summary: entry.summary,
    evidence: entry.evidence,
    recommendation: entry.recommendation,
    action: entry.action,
    source: 'Financial Education',
  };
}

export function buildConversationalResponse(
  kind: 'greeting' | 'thanks' | 'farewell' | 'small_talk' | 'platform_help',
  firstName: string
): StructuredAIResponse {
  const name = firstName || 'there';

  if (kind === 'greeting') {
    return {
      title: 'Welcome',
      summary: `Hello ${name}! How can I assist with your finances today? I can review your live SmartFin data or explain budgeting, savings, debt, and investing concepts.`,
      evidence: [
        'Try "Give me a monthly financial summary" for your ledger.',
        'Or ask "What is the 50/30/20 rule?" for general guidance.',
      ],
      recommendation: 'Pick a quick prompt below or type any finance question.',
      source: 'SmartFin AI Copilot',
    };
  }

  if (kind === 'thanks') {
    return {
      summary: `You're welcome, ${name}! Let me know if you'd like to dig into your spending, budgets, or any finance topic.`,
      source: 'SmartFin AI Copilot',
    };
  }

  if (kind === 'farewell') {
    return {
      summary: `Goodbye, ${name}! I'll be here whenever you want to check your finances or plan your next move.`,
      source: 'SmartFin AI Copilot',
    };
  }

  if (kind === 'small_talk') {
    return {
      summary: `I'm doing well, thanks for asking! Ready to help you understand your money — whether that's this month's expenses or a concept like emergency funds.`,
      recommendation: 'Ask about your data or any personal finance topic.',
      source: 'SmartFin AI Copilot',
    };
  }

  return {
    title: 'How I Can Help',
    summary:
      'I answer from your SmartFin ledger (income, expenses, savings, budgets, anomalies, forecasts) and explain general personal finance topics. I do not invent numbers — personal figures always come from your records.',
    evidence: [
      'Personal: "How much did I spend on food?" or "Compare this month with last month."',
      'Education: "What is an emergency fund?" or "Explain the 50/30/20 rule."',
      'Scenarios: "Can I afford a laptop for Rs. 150,000?"',
    ],
    recommendation: 'What would you like to explore first?',
    source: 'SmartFin AI Copilot',
  };
}

export function buildOffTopicResponse(firstName: string): StructuredAIResponse {
  const name = firstName || 'there';
  return {
    title: 'Finance Assistant',
    summary: `I'm focused on personal finance and your SmartFin tools, ${name}. I can't help much with that topic, but I'd be glad to review your spending, budgets, savings goals, or explain a money concept.`,
    evidence: [
      'Dashboard and Analytics show your income, expenses, and trends.',
      'Budgets, Predictions, and Financial Health help you plan ahead.',
    ],
    recommendation: 'Try asking about your monthly summary or a finance concept like budgeting or emergency funds.',
    action: { label: 'Open Dashboard', href: '/dashboard' },
    source: 'SmartFin AI Copilot',
  };
}

export function buildOpenFinanceGuidance(firstName: string): StructuredAIResponse {
  const name = firstName || 'there';
  return {
    summary: `Happy to help, ${name}. I can pull answers from your SmartFin records or explain personal finance topics like budgeting, debt payoff, and saving strategies.`,
    evidence: [
      'Personal data: "How much did I spend this month?" or "Where am I spending the most?"',
      'General: "What is compound interest?" or "How does the debt snowball work?"',
    ],
    recommendation: 'Tell me whether you want your live numbers or a general explanation.',
    source: 'SmartFin AI Copilot',
  };
}
