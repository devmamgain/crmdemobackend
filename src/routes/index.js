import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import * as leads from '../controllers/leadController.js';
import * as deals from '../controllers/dealController.js';
import * as people from '../controllers/salespersonController.js';
import * as fmv from '../controllers/fmvController.js';
import * as reports from '../controllers/reportController.js';
import * as ai from '../controllers/aiController.js';
import { dashboard } from '../controllers/dashboardController.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(), // never written to disk
  limits: { fileSize: env.fmv.maxFileBytes, files: 1 },
  fileFilter: (_req, file, cb) =>
    /\.(xlsx|xls|csv)$/i.test(file.originalname)
      ? cb(null, true)
      : cb(new ApiError(400, 'Only .xlsx, .xls or .csv files are accepted')),
});
const heavyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many analysis requests. Please wait a few minutes.' },
});

router.get('/dashboard', dashboard);

router.route('/leads').get(leads.listLeads).post(leads.createLead);
router.route('/leads/:id').get(leads.getLead).patch(leads.updateLead).delete(leads.deleteLead);

router.route('/deals').get(deals.listDeals).post(deals.createDeal);
router.route('/deals/:id').get(deals.getDeal).patch(deals.updateDeal).delete(deals.deleteDeal);

router.get('/salespeople', people.listSalespeople);
router.get('/salespeople/:id', people.getSalesperson);

router.get('/reports/overview', reports.overview);
router.get('/reports/salesperson/:id', reports.salespersonReport);

router.post('/fmv/analyze', heavyLimiter, upload.single('file'), fmv.analyze);
router.get('/fmv/history', fmv.history);
router.get('/fmv/history/:id', fmv.historyById);
router.get('/fmv/market-data', fmv.marketData);
router.post('/fmv/market-data', fmv.addMarketData);
router.get('/fmv/sample/:name', fmv.sampleFile);

router.post('/ai/leads/generate', heavyLimiter, ai.generateLeads);

export default router;
