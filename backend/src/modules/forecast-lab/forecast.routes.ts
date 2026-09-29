import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { run } from './forecast.controller.js';

const router = Router();

router.use(requireAuth);
router.post('/', run);

export default router;
