import { z } from 'zod';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD.');
const extraFieldsSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional();

export const importIncomeRowSchema = z.object({
  amount: z.coerce.number().positive(),
  source: z.string().trim().min(1).max(120),
  date: dateString,
  incomeType: z.string().trim().max(40).optional(),
  description: z.string().trim().max(240).optional(),
  recurring: z.boolean().optional(),
  extraFields: extraFieldsSchema,
});

export const importExpenseRowSchema = z.object({
  amount: z.coerce.number().positive(),
  description: z.string().trim().min(1).max(240),
  date: dateString,
  category: z.string().trim().max(80).optional(),
  subcategory: z.string().trim().max(80).optional(),
  paymentMethod: z.string().trim().max(40).optional(),
  transactionType: z.string().trim().max(10).optional(),
  recurring: z.boolean().optional(),
  extraFields: extraFieldsSchema,
});

export const importCommitJsonSchema = z.object({
  incomes: z.array(importIncomeRowSchema).default([]),
  expenses: z.array(importExpenseRowSchema).default([]),
});

export type ImportCommitJsonInput = z.infer<typeof importCommitJsonSchema>;
