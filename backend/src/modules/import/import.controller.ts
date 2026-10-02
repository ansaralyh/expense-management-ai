import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { validate } from '../../middleware/validate.js';
import { importCommitJsonSchema } from './import.validation.js';
import {
  buildExpensesCsv,
  buildIncomeCsv,
  buildTemplate,
  commitImport,
  commitImportJson,
  previewImport,
} from './import.service.js';

function sendFile(res: Response, buffer: Buffer, contentType: string, filename: string) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', String(buffer.length));
  res.status(200).end(buffer);
}

function requireFile(req: Request) {
  if (!req.file?.buffer) {
    throw new AppError('Choose an Excel file to upload.', 400);
  }
  return req.file.buffer;
}

export const template = asyncHandler(async (_req: Request, res: Response) => {
  sendFile(
    res,
    buildTemplate(),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'smartfin-import-template.xlsx'
  );
});

export const templateIncomeCsv = asyncHandler(async (_req: Request, res: Response) => {
  sendFile(res, buildIncomeCsv(), 'text/csv; charset=utf-8', 'smartfin-income-template.csv');
});

export const templateExpensesCsv = asyncHandler(async (_req: Request, res: Response) => {
  sendFile(res, buildExpensesCsv(), 'text/csv; charset=utf-8', 'smartfin-expenses-template.csv');
});

export const preview = asyncHandler(async (req: Request, res: Response) => {
  const buffer = requireFile(req);
  const result = previewImport(buffer);
  res.status(200).json({
    status: 'success',
    ...result,
  });
});

export const commit = asyncHandler(async (req: Request, res: Response) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('application/json')) {
    const result = await commitImportJson(req.user!.id, req.body);
    res.status(200).json({
      status: 'success',
      message: 'Import completed. Dashboard, budgets, analytics, and reports now use the new entries.',
      ...result,
    });
    return;
  }

  const buffer = requireFile(req);
  const result = await commitImport(req.user!.id, buffer);
  res.status(200).json({
    status: 'success',
    message: 'Import completed. Dashboard, budgets, analytics, and reports now use the new entries.',
    ...result,
  });
});

export const commitJsonMiddleware = validate(importCommitJsonSchema);
