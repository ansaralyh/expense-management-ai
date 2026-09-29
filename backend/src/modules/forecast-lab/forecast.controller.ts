import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { runForecastLab } from './forecast.service.js';

export const run = asyncHandler(async (req: Request, res: Response) => {
  const result = await runForecastLab(req.user!.id);
  res.status(200).json(result);
});
