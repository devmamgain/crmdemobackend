import mongoose from 'mongoose';
import { ApiError } from './ApiError.js';

export const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost'];
export const DEAL_STAGES = ['New', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
export const ACTIVE_STAGES = ['New', 'Qualified', 'Proposal', 'Negotiation'];
export const PRIORITIES = ['Low', 'Medium', 'High'];
export const SERVICE_TYPES = [
  'IT Asset Recovery',
  'Equipment Buyback',
  'Data Center Decommissioning',
  'Lease Return Remarketing',
  'Refresh Trade-in',
  'Secure Data Destruction',
];

export const isId = (v) => mongoose.isValidObjectId(v);
export const assertId = (v, label = 'id') => {
  if (!isId(v)) throw new ApiError(400, `Invalid ${label}`);
  return v;
};

const str = (v) => String(v ?? '').trim();

function readOwner(body, out, errors) {
  if (body.salespersonId === undefined) return;
  const v = body.salespersonId;
  if (v === '' || v === null) out.salespersonId = null;
  else if (!isId(v)) errors.push('Invalid salesperson');
  else out.salespersonId = v;
}

function readMoney(body, key, label, out, errors) {
  if (body[key] === undefined) return;
  const n = Number(body[key] === '' ? 0 : body[key]);
  if (!Number.isFinite(n) || n < 0) errors.push(`${label} must be a number greater than or equal to 0`);
  else out[key] = n;
}

function readService(body, key, out, errors) {
  if (body[key] === undefined) return;
  const v = str(body[key]);
  if (v && !SERVICE_TYPES.includes(v)) errors.push(`Service must be one of: ${SERVICE_TYPES.join(', ')}`);
  else out[key] = v;
}

function readCount(body, key, label, out, errors) {
  if (body[key] === undefined) return;
  const n = Number(body[key] === '' ? 0 : body[key]);
  if (!Number.isInteger(n) || n < 0) errors.push(`${label} must be a whole number greater than or equal to 0`);
  else out[key] = n;
}

export function validateLead(body = {}, { partial = false } = {}) {
  const errors = [];
  const out = {};
  const has = (k) => body[k] !== undefined;

  for (const [key, label] of [['name', 'Name'], ['company', 'Company']]) {
    if (!partial || has(key)) {
      const v = str(body[key]);
      if (!v) errors.push(`${label} is required`);
      out[key] = v;
    }
  }
  if (has('email')) {
    const v = str(body.email);
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors.push('Email address is not valid');
    out.email = v;
  }
  for (const key of ['phone', 'source', 'notes', 'industry']) if (has(key)) out[key] = str(body[key]);
  readService(body, 'serviceInterest', out, errors);
  readCount(body, 'assetVolume', 'Estimated asset volume', out, errors);
  if (has('status')) {
    if (!LEAD_STATUSES.includes(body.status)) errors.push(`Status must be one of: ${LEAD_STATUSES.join(', ')}`);
    else out.status = body.status;
  }
  readMoney(body, 'estimatedValue', 'Estimated value', out, errors);
  readOwner(body, out, errors);

  if (errors.length) throw new ApiError(400, errors.join('. '));
  return out;
}

export function validateDeal(body = {}, { partial = false } = {}) {
  const errors = [];
  const out = {};
  const has = (k) => body[k] !== undefined;

  for (const [key, label] of [['title', 'Title'], ['company', 'Company']]) {
    if (!partial || has(key)) {
      const v = str(body[key]);
      if (!v) errors.push(`${label} is required`);
      out[key] = v;
    }
  }
  if (has('description')) out.description = str(body.description);
  readService(body, 'serviceType', out, errors);
  readCount(body, 'assetCount', 'Asset count', out, errors);
  if (has('stage')) {
    if (!DEAL_STAGES.includes(body.stage)) errors.push(`Stage must be one of: ${DEAL_STAGES.join(', ')}`);
    else out.stage = body.stage;
  }
  if (has('priority')) {
    if (!PRIORITIES.includes(body.priority)) errors.push(`Priority must be one of: ${PRIORITIES.join(', ')}`);
    else out.priority = body.priority;
  }
  if (has('expectedCloseDate')) {
    if (!body.expectedCloseDate) out.expectedCloseDate = null;
    else {
      const d = new Date(body.expectedCloseDate);
      if (Number.isNaN(d.getTime())) errors.push('Expected close date is not valid');
      else out.expectedCloseDate = d;
    }
  }
  readMoney(body, 'value', 'Deal value', out, errors);
  readOwner(body, out, errors);

  if (errors.length) throw new ApiError(400, errors.join('. '));
  return out;
}
