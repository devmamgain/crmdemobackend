import Lead from '../models/Lead.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { assertId, validateLead } from '../utils/validate.js';
import { escapeRegex } from '../utils/text.js';

const SORT_KEYS = ['createdAt', 'estimatedValue', 'name', 'company', 'status'];
const OWNER_FIELDS = 'name avatar email';

export const listLeads = asyncHandler(async (req, res) => {
  const { q, status, salespersonId, sort = '-createdAt' } = req.query;
  const filter = {};
  if (status) filter.status = String(status);
  if (salespersonId) {
    filter.salespersonId = salespersonId === 'unassigned' ? null : assertId(salespersonId, 'salespersonId');
  }
  if (q) {
    const rx = new RegExp(escapeRegex(String(q).slice(0, 80)), 'i');
    filter.$or = [{ name: rx }, { company: rx }, { email: rx }];
  }
  const key = String(sort).replace(/^-/, '');
  const dir = String(sort).startsWith('-') ? -1 : 1;
  const data = await Lead.find(filter)
    .sort({ [SORT_KEYS.includes(key) ? key : 'createdAt']: dir })
    .limit(1000)
    .populate('salespersonId', OWNER_FIELDS)
    .lean();
  res.json({ success: true, total: data.length, data });
});

export const getLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(assertId(req.params.id)).populate('salespersonId', OWNER_FIELDS).lean();
  if (!lead) throw new ApiError(404, 'Lead not found');
  res.json({ success: true, data: lead });
});

export const createLead = asyncHandler(async (req, res) => {
  const lead = await Lead.create(validateLead(req.body));
  await lead.populate('salespersonId', OWNER_FIELDS);
  res.status(201).json({ success: true, data: lead });
});

export const updateLead = asyncHandler(async (req, res) => {
  const update = validateLead(req.body, { partial: true });
  const lead = await Lead.findByIdAndUpdate(assertId(req.params.id), update, { new: true, runValidators: true })
    .populate('salespersonId', OWNER_FIELDS)
    .lean();
  if (!lead) throw new ApiError(404, 'Lead not found');
  res.json({ success: true, data: lead });
});

export const deleteLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findByIdAndDelete(assertId(req.params.id));
  if (!lead) throw new ApiError(404, 'Lead not found');
  res.json({ success: true, message: 'Lead deleted' });
});
