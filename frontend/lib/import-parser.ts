import * as XLSX from 'xlsx';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const INCOME_TYPE_HINTS = ['salary', 'freelance', 'business', 'investment', 'gift', 'other'];
const EXPENSE_CATEGORY_HINTS = [
  'food',
  'transport',
  'rent',
  'bills',
  'education',
  'healthcare',
  'shopping',
  'entertainment',
  'travel',
  'utilities',
  'other',
];

export type ImportCommitPayload = {
  incomes: Array<{
    amount: number;
    source: string;
    date: string;
    incomeType?: string;
    description?: string;
    recurring?: boolean;
    extraFields?: Record<string, string>;
  }>;
  expenses: Array<{
    amount: number;
    description: string;
    date: string;
    category?: string;
    subcategory?: string;
    paymentMethod?: string;
    transactionType?: string;
    recurring?: boolean;
    extraFields?: Record<string, string>;
  }>;
};

export type LocalImportRow = {
  row: number;
  sheet: string;
  kind: 'income' | 'expense';
  date: string;
  amount: number | null;
  type: string;
  label: string;
  detail?: string;
  extraFields: Record<string, string>;
};

export type LocalImportPreview = {
  fileName: string;
  sheetKind: 'income' | 'expense' | 'mixed' | 'unknown';
  rows: LocalImportRow[];
  extraColumns: string[];
  payload: ImportCommitPayload;
  incomeCount: number;
  expenseCount: number;
  incomeTotal: number;
  expenseTotal: number;
  missingHeaders: string[];
  structureErrors: string[];
  structureValid: boolean;
  hasData: boolean;
  canSend: boolean;
};

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value ?? '')
    .replace(/,/g, '')
    .replace(/rs\.?/gi, '')
    .trim();
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

function parseDateValue(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }
  const text = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const slash = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slash) {
    const [, day, month, year] = slash;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return text;
}

function parseBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  const text = String(value ?? '')
    .trim()
    .toLowerCase();
  return text === 'true' || text === 'yes' || text === 'y' || text === '1';
}

function sheetRows(sheet: XLSX.WorkSheet) {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];
}

function recordFromRow(headers: string[], row: unknown[]) {
  const record: Record<string, string> = {};
  headers.forEach((header, index) => {
    const key = String(header ?? '').trim();
    if (!key) return;
    record[key] = String(row[index] ?? '').trim();
  });
  return record;
}

function getByAliases(record: Record<string, string>, aliases: string[]) {
  const normalizedEntries = Object.entries(record).map(([key, value]) => [normalizeHeader(key), value] as const);
  for (const alias of aliases) {
    const match = normalizedEntries.find(([key]) => key === normalizeHeader(alias));
    if (match?.[1]) return match[1];
  }
  return '';
}

const FIELD_ALIASES = {
  amount: ['amount', 'value', 'total', 'sum', 'amt'],
  date: ['date', 'transactiondate', 'txndate', 'incomedate', 'expensedate'],
  kind: ['type', 'transactiontype', 'entrytype', 'txntype', 'incomeexpense', 'incomeorexpense'],
  category: ['category', 'expensecategory', 'cat'],
  description: ['description', 'details', 'detail', 'memo', 'notes', 'note', 'narration'],
  source: ['source', 'incomesource', 'from', 'payee', 'payer'],
  incomeType: ['incometype', 'incomecategory'],
  paymentMethod: ['paymentmethod', 'payment', 'method', 'paidvia'],
  transactionType: ['transactiontype', 'needwant', 'needorwant', 'need/want'],
  subcategory: ['subcategory', 'subcat'],
  recurring: ['recurring', 'repeat', 'monthly'],
} as const;

const USED_NORMALIZED = new Set(
  Object.values(FIELD_ALIASES)
    .flat()
    .map((alias) => normalizeHeader(alias))
);

function extractExtraFields(record: Record<string, string>) {
  const extra: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!value) continue;
    if (USED_NORMALIZED.has(normalizeHeader(key))) continue;
    extra[key] = value;
  }
  return extra;
}

function detectRowKind(record: Record<string, string>): 'income' | 'expense' | null {
  const typeValue = getByAliases(record, [...FIELD_ALIASES.kind]).toLowerCase();
  if (typeValue) {
    if (typeValue.includes('income') || /^(inc|credit|deposit|inflow|salary)$/.test(typeValue)) return 'income';
    if (typeValue.includes('expense') || /^(exp|debit|outflow|spend|payment)$/.test(typeValue)) return 'expense';
    if (typeValue === 'need' || typeValue === 'want') {
      // Column is Need/Want, not income/expense — keep detecting from other fields.
    }
  }

  const incomeType = getByAliases(record, [...FIELD_ALIASES.incomeType]);
  const category = getByAliases(record, [...FIELD_ALIASES.category]);
  const source = getByAliases(record, [...FIELD_ALIASES.source]);
  const description = getByAliases(record, [...FIELD_ALIASES.description]);
  const paymentMethod = getByAliases(record, [...FIELD_ALIASES.paymentMethod]);

  const incomeHint = (value: string) =>
    INCOME_TYPE_HINTS.some((hint) => value.toLowerCase().includes(hint));

  if (incomeType && incomeHint(incomeType)) return 'income';
  if (category && incomeHint(category)) return 'income';
  if (source && incomeHint(source)) return 'income';
  if (description && /salary|payroll|wage|bonus|freelance|business income|investment return/i.test(description) && !paymentMethod) {
    return 'income';
  }

  if (source && !paymentMethod) return 'income';
  if (description || paymentMethod) return 'expense';
  if (category && EXPENSE_CATEGORY_HINTS.some((hint) => category.toLowerCase().includes(hint))) return 'expense';

  return 'expense';
}

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseSheet(sheetName: string, sheet: XLSX.WorkSheet) {
  const matrix = sheetRows(sheet);
  if (matrix.length === 0) {
    return {
      rows: [] as LocalImportRow[],
      payload: { incomes: [], expenses: [] } as ImportCommitPayload,
      errors: [] as string[],
      extraColumns: [] as string[],
    };
  }

  const headers = matrix[0].map((cell) => String(cell ?? '').trim());
  const hasAmount = headers.some((header) => FIELD_ALIASES.amount.some((alias) => normalizeHeader(header) === normalizeHeader(alias)));
  const hasDate = headers.some((header) => FIELD_ALIASES.date.some((alias) => normalizeHeader(header) === normalizeHeader(alias)));

  const rows: LocalImportRow[] = [];
  const payload: ImportCommitPayload = { incomes: [], expenses: [] };
  const errors: string[] = [];
  const extraColumnSet = new Set<string>();

  if (!hasAmount) errors.push(`${sheetName}: missing an Amount column.`);
  if (!hasDate) errors.push(`${sheetName}: missing a Date column.`);

  for (let i = 1; i < matrix.length; i += 1) {
    const rawRow = matrix[i];
    if (!rawRow || rawRow.every((cell) => String(cell ?? '').trim() === '')) continue;

    const record = recordFromRow(headers, rawRow);
    const amount = parseAmount(getByAliases(record, [...FIELD_ALIASES.amount]));
    const dateRaw = getByAliases(record, [...FIELD_ALIASES.date]);
    const date = parseDateValue(dateRaw);
    const kind = detectRowKind(record) ?? 'expense';
    const extraFields = extractExtraFields(record);
    Object.keys(extraFields).forEach((key) => extraColumnSet.add(key));

    if (amount == null || amount <= 0) {
      errors.push(`${sheetName} row ${i + 1}: amount must be greater than 0.`);
      continue;
    }
    if (!isValidIsoDate(date)) {
      errors.push(`${sheetName} row ${i + 1}: invalid date "${dateRaw || '—'}".`);
      continue;
    }

    const category = getByAliases(record, [...FIELD_ALIASES.category]);
    const description = getByAliases(record, [...FIELD_ALIASES.description]);
    const source = getByAliases(record, [...FIELD_ALIASES.source]);
    const incomeType = getByAliases(record, [...FIELD_ALIASES.incomeType]) || category;
    const paymentMethod = getByAliases(record, [...FIELD_ALIASES.paymentMethod]);
    const transactionType = getByAliases(record, [...FIELD_ALIASES.transactionType]);
    const subcategory = getByAliases(record, [...FIELD_ALIASES.subcategory]);
    const recurring = parseBoolean(getByAliases(record, [...FIELD_ALIASES.recurring]));

    if (kind === 'income') {
      const resolvedSource = source || description || category || 'Imported income';
      payload.incomes.push({
        amount,
        source: resolvedSource,
        date,
        incomeType: incomeType || 'Other',
        description: description || undefined,
        recurring,
        extraFields: Object.keys(extraFields).length ? extraFields : undefined,
      });
      rows.push({
        row: i + 1,
        sheet: sheetName,
        kind,
        date,
        amount,
        type: incomeType || category || 'Income',
        label: resolvedSource,
        detail: description || undefined,
        extraFields,
      });
    } else {
      const resolvedDescription = description || source || category || 'Imported expense';
      payload.expenses.push({
        amount,
        description: resolvedDescription,
        date,
        category: category || 'Other',
        subcategory: subcategory || undefined,
        paymentMethod: paymentMethod || 'Other',
        transactionType: transactionType || 'NEED',
        recurring,
        extraFields: Object.keys(extraFields).length ? extraFields : undefined,
      });
      rows.push({
        row: i + 1,
        sheet: sheetName,
        kind,
        date,
        amount,
        type: category || 'Expense',
        label: resolvedDescription,
        detail: [paymentMethod, transactionType].filter(Boolean).join(' · ') || undefined,
        extraFields,
      });
    }
  }

  return {
    rows,
    payload,
    errors,
    extraColumns: Array.from(extraColumnSet).sort((a, b) => a.localeCompare(b)),
  };
}

export function validateImportFile(file: File): string | null {
  const lower = file.name.toLowerCase();
  const allowed =
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    lower.endsWith('.csv') ||
    file.type.includes('spreadsheet') ||
    file.type.includes('excel') ||
    file.type === 'text/csv';
  if (!allowed) return 'Upload an Excel workbook (.xlsx, .xls) or CSV file.';
  if (file.size > MAX_FILE_BYTES) return 'File is too large. Maximum size is 5 MB.';
  if (file.size === 0) return 'The selected file is empty.';
  return null;
}

export async function parseImportFile(file: File): Promise<LocalImportPreview> {
  const fileError = validateImportFile(file);
  if (fileError) {
    return {
      fileName: file.name,
      sheetKind: 'unknown',
      rows: [],
      extraColumns: [],
      payload: { incomes: [], expenses: [] },
      incomeCount: 0,
      expenseCount: 0,
      incomeTotal: 0,
      expenseTotal: 0,
      missingHeaders: [],
      structureErrors: [fileError],
      structureValid: false,
      hasData: false,
      canSend: false,
    };
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const parsedSheets = workbook.SheetNames.map((sheetName) => ({
    sheetName,
    ...parseSheet(sheetName, workbook.Sheets[sheetName]),
  }));

  const rows = parsedSheets.flatMap((sheet) => sheet.rows);
  const payload: ImportCommitPayload = {
    incomes: parsedSheets.flatMap((sheet) => sheet.payload.incomes),
    expenses: parsedSheets.flatMap((sheet) => sheet.payload.expenses),
  };
  const structureErrors = parsedSheets.flatMap((sheet) => sheet.errors);
  const extraColumns = Array.from(new Set(parsedSheets.flatMap((sheet) => sheet.extraColumns))).sort((a, b) =>
    a.localeCompare(b)
  );

  const incomeCount = payload.incomes.length;
  const expenseCount = payload.expenses.length;
  const incomeTotal = payload.incomes.reduce((sum, row) => sum + row.amount, 0);
  const expenseTotal = payload.expenses.reduce((sum, row) => sum + row.amount, 0);
  const sheetKind: LocalImportPreview['sheetKind'] =
    incomeCount > 0 && expenseCount > 0 ? 'mixed' : incomeCount > 0 ? 'income' : expenseCount > 0 ? 'expense' : 'unknown';

  const hasData = rows.length > 0;
  const structureValid = hasData;

  return {
    fileName: file.name,
    sheetKind,
    rows,
    extraColumns,
    payload,
    incomeCount,
    expenseCount,
    incomeTotal,
    expenseTotal,
    missingHeaders: [],
    structureErrors: hasData ? structureErrors.slice(0, 8) : ['No importable rows were found. Check Amount and Date columns.'],
    structureValid,
    hasData,
    canSend: hasData,
  };
}

export function formatImportValidationError(preview: LocalImportPreview) {
  if (preview.structureErrors.length > 0) return preview.structureErrors[0];
  if (!preview.hasData) return 'No data rows were found in the file.';
  return 'Unable to import this file.';
}
