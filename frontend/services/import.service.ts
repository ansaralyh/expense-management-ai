import { apiDownload, apiRequest, apiUpload } from '../lib/api';
import { ImportCommitPayload } from '../lib/import-parser';

export type ImportPreviewRow = {
  row: number;
  sheet: string;
  amount: number;
  source?: string;
  description?: string;
  category?: string;
  date: string;
  incomeType?: string;
  paymentMethod?: string;
  transactionType?: string;
};

export type ImportPreviewResponse = {
  status: string;
  incomeCount: number;
  expenseCount: number;
  incomeTotal: number;
  expenseTotal: number;
  netFromFile: number;
  needsTotal: number;
  wantsTotal: number;
  incomes: ImportPreviewRow[];
  expenses: ImportPreviewRow[];
  errors: { sheet: string; row: number; message: string }[];
  errorCount: number;
  ready: boolean;
};

export type ImportCommitResponse = {
  status: string;
  message: string;
  imported: {
    incomeCount: number;
    expenseCount: number;
    incomeTotal: number;
    expenseTotal: number;
    netFromFile: number;
  };
  currentMonth: {
    key: string;
    label: string;
    income: number;
    expense: number;
    savings: number;
    savingsRate: number;
  };
};

export const importService = {
  downloadTemplate() {
    return apiDownload('/api/import/template', 'smartfin-import-template.xlsx');
  },
  downloadIncomeCsv() {
    return apiDownload('/api/import/template/income.csv', 'smartfin-income-template.csv');
  },
  downloadExpensesCsv() {
    return apiDownload('/api/import/template/expenses.csv', 'smartfin-expenses-template.csv');
  },
  preview(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return apiUpload<ImportPreviewResponse>('/api/import/preview', formData);
  },
  commit(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return apiUpload<ImportCommitResponse>('/api/import/', formData);
  },
  commitRows(payload: ImportCommitPayload) {
    return apiRequest<ImportCommitResponse>('/api/import/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
