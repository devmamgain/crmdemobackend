import { asyncHandler } from '../utils/asyncHandler.js';
import { getDashboard } from '../services/analyticsService.js';

export const dashboard = asyncHandler(async (_req, res) => {
  res.json({ success: true, ...(await getDashboard()) });
});
