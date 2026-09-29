import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../auth/auth.middleware.js';
import { scanReceipt } from './receipt.controller.js';
import { RECEIPT_MAX_BYTES, detectReceiptFileKind } from './receipt.document.js';

const upload = multer({
  limits: { fileSize: RECEIPT_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const kind = detectReceiptFileKind(file.mimetype, file.originalname);
    if (!kind) {
      cb(new Error('Unsupported file type. Use JPG, PNG, WEBP, PDF, CSV, XLSX, or XLS up to 5MB.'));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.use(requireAuth);
router.post('/scan', upload.single('receipt'), scanReceipt);

export default router;
