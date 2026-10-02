import Salesperson from '../models/Salesperson.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { assertId } from '../utils/validate.js';

export const listSalespeople = asyncHandler(async (_req, res) => {
  const data = await Salesperson.find({ active: true }).sort({ name: 1 }).lean();
  res.json({ success: true, data });
});

export const getSalesperson = asyncHandler(async (req, res) => {
  const data = await Salesperson.findById(assertId(req.params.id)).lean();
  if (!data) throw new ApiError(404, 'Salesperson not found');
  res.json({ success: true, data });
});
