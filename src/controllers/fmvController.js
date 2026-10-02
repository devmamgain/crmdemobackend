import path from 'node:path';
import { fileURLToPath } from 'node:url';
import FMVAnalysis from '../models/FMVAnalysis.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { assertId } from '../utils/validate.js';
import { analyzeInventory } from '../services/fmvService.js';
import { listMarketData, upsertMarketValue } from '../services/marketDataService.js';

const SAMPLE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../sample-data');
const SAMPLES = ['sample-inventory.xlsx', 'sample-datacenter-decommission.xlsx', 'sample-inventory-with-unknown.xlsx'];

export const analyze = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Attach a spreadsheet in the "file" field (.xlsx, .xls or .csv).');
  const salespersonId = req.body?.salespersonId ? assertId(req.body.salespersonId, 'salespersonId') : null;
  const result = await analyzeInventory({ buffer: req.file.buffer, filename: req.file.originalname, salespersonId });
  res.status(201).json({ success: true, ...result });
});

export const history = asyncHandler(async (_req, res) => {
  const data = await FMVAnalysis.find().select('-items -aiInsights').sort({ createdAt: -1 }).limit(20).lean();
  res.json({ success: true, data });
});

export const historyById = asyncHandler(async (req, res) => {
  const a = await FMVAnalysis.findById(assertId(req.params.id)).lean();
  if (!a) throw new ApiError(404, 'Analysis not found');
  res.json({
    success: true,
    id: a._id,
    filename: a.filename,
    createdAt: a.createdAt,
    summary: {
      itemsAnalyzed: a.itemsAnalyzed,
      totalQuantity: a.totalQuantity,
      unmatchedCount: a.unmatchedCount,
      estimatedMarketValue: a.estimatedMarketValue,
      recommendedBuyValue: a.recommendedBuyValue,
      estimatedResaleValue: a.estimatedResaleValue ?? a.estimatedMarketValue,
      estimatedPotentialMargin: a.potentialMargin,
      marginPct: (a.estimatedResaleValue ?? a.estimatedMarketValue) ? Math.round((a.potentialMargin / (a.estimatedResaleValue ?? a.estimatedMarketValue)) * 10000) / 100 : 0,
      buyRatio: a.buyRatio,
      resaleRatio: a.resaleRatio ?? 1,
    },
    items: a.items,
    warnings: a.warnings,
    aiInsights: a.aiInsights,
  });
});

export const marketData = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await listMarketData() });
});

export const addMarketData = asyncHandler(async (req, res) => {
  const doc = await upsertMarketValue(req.body || {});
  res.status(201).json({ success: true, data: doc });
});

export const sampleFile = (req, res, next) => {
  if (!SAMPLES.includes(req.params.name)) return next(new ApiError(404, 'Sample file not found'));
  res.download(path.join(SAMPLE_DIR, req.params.name));
};
