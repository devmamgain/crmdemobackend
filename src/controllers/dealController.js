import Deal from '../models/Deal.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { assertId, validateDeal } from '../utils/validate.js';
import { stageBreakdown } from '../services/analyticsService.js';
import mongoose from 'mongoose';

const OWNER_FIELDS = 'name avatar email';
const closedAtFor = (stage) => (stage === 'Won' || stage === 'Lost' ? new Date() : null);

export const listDeals = asyncHandler(async (req, res) => {
  const { salespersonId, stage } = req.query;
  const filter = {};
  if (stage) filter.stage = String(stage);
  if (salespersonId) filter.salespersonId = assertId(salespersonId, 'salespersonId');
  const [data, summary] = await Promise.all([
    Deal.find(filter).sort({ updatedAt: -1 }).limit(1000).populate('salespersonId', OWNER_FIELDS).lean(),
    // Column totals come from the database so they always match the real pipeline.
    stageBreakdown(
      filter.salespersonId ? { salespersonId: new mongoose.Types.ObjectId(filter.salespersonId) } : {}
    ),
  ]);
  res.json({ success: true, total: data.length, summary, data });
});

export const getDeal = asyncHandler(async (req, res) => {
  const deal = await Deal.findById(assertId(req.params.id)).populate('salespersonId', OWNER_FIELDS).lean();
  if (!deal) throw new ApiError(404, 'Deal not found');
  res.json({ success: true, data: deal });
});

export const createDeal = asyncHandler(async (req, res) => {
  const data = validateDeal(req.body);
  if (data.stage) data.closedAt = closedAtFor(data.stage);
  const deal = await Deal.create(data);
  await deal.populate('salespersonId', OWNER_FIELDS);
  res.status(201).json({ success: true, data: deal });
});

export const updateDeal = asyncHandler(async (req, res) => {
  const id = assertId(req.params.id);
  const update = validateDeal(req.body, { partial: true });
  const existing = await Deal.findById(id).select('stage closedAt');
  if (!existing) throw new ApiError(404, 'Deal not found');
  if (update.stage && update.stage !== existing.stage) update.closedAt = closedAtFor(update.stage);
  const deal = await Deal.findByIdAndUpdate(id, update, { new: true, runValidators: true })
    .populate('salespersonId', OWNER_FIELDS)
    .lean();
  res.json({ success: true, data: deal });
});

export const deleteDeal = asyncHandler(async (req, res) => {
  const deal = await Deal.findByIdAndDelete(assertId(req.params.id));
  if (!deal) throw new ApiError(404, 'Deal not found');
  res.json({ success: true, message: 'Deal deleted' });
});
