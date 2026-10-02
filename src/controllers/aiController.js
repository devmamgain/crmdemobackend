import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { generateLeadSuggestions } from '../services/llmService.js';

const clean = (v, max = 300) => String(v ?? '').trim().slice(0, max);

export const generateLeads = asyncHandler(async (req, res) => {
  const criteria = {
    industry: clean(req.body?.industry, 120),
    region: clean(req.body?.region, 120),
    product: clean(req.body?.product, 200),
    idealCustomer: clean(req.body?.idealCustomer, 600),
  };
  const missing = ['industry', 'region', 'product'].filter((k) => !criteria[k]);
  if (missing.length) throw new ApiError(400, `Please provide: ${missing.join(', ')}`);
  const result = await generateLeadSuggestions(criteria);
  res.json({
    success: true,
    ...result,
    disclaimer: 'AI-generated prospect suggestions. They are not verified and contain no contact data; verify before outreach.',
  });
});
