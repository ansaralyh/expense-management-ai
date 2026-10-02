import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { importUpload } from '../../middleware/upload.js';
import {
  commit,
  commitJsonMiddleware,
  preview,
  template,
  templateExpensesCsv,
  templateIncomeCsv,
} from './import.controller.js';

const router = Router();

router.get('/template', template);
router.get('/template/income.csv', templateIncomeCsv);
router.get('/template/expenses.csv', templateExpensesCsv);

router.use(requireAuth);
router.post('/preview', importUpload, preview);
router.post('/', (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('application/json')) {
    return commitJsonMiddleware(req, res, (err) => {
      if (err) return next(err);
      return commit(req, res, next);
    });
  }
  return importUpload(req, res, (err) => {
    if (err) return next(err);
    return commit(req, res, next);
  });
});

export default router;
