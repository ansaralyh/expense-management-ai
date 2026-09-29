import { z } from 'zod';

export const summaryRangeValues = ['all', 'last3', 'last6', 'thisYear'] as const;

export const summaryQuerySchema = z.object({
  months: z.coerce.number().int().min(3).max(24).optional().default(6),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM.')
    .optional(),
  range: z.enum(summaryRangeValues).optional(),
});

export type SummaryQuery = z.infer<typeof summaryQuerySchema>;
