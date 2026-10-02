import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { assertId } from '../utils/validate.js';
import { getReport } from '../services/analyticsService.js';

export const overview = asyncHandler(async (req, res) => {
  const id = req.query.salespersonId ? assertId(req.query.salespersonId, 'salespersonId') : null;
  res.json({ success: true, ...(await getReport(id)) });
});

export const salespersonReport = asyncHandler(async (req, res) => {
  const report = await getReport(assertId(req.params.id));
  if (!report.salesperson) throw new ApiError(404, 'Salesperson not found');
  res.json({ success: true, ...report });
});
