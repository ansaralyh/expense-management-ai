import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

const skipOutsideProduction = () => config.nodeEnv !== 'production';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipOutsideProduction,
  validate: { xForwardedForHeader: false },
  message: {
    status: 'error',
    message: 'Too many requests. Try again in a few minutes.',
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipOutsideProduction,
  validate: { xForwardedForHeader: false },
  message: {
    status: 'error',
    message: 'Too many sign-in attempts. Try again in a few minutes.',
  },
});
