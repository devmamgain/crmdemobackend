import mongoose from 'mongoose';
import { LEAD_STATUSES } from '../utils/validate.js';

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    email: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    industry: { type: String, trim: true, default: '' },
    serviceInterest: { type: String, default: '' },
    assetVolume: { type: Number, min: 0, default: 0 }, // estimated number of IT assets
    source: { type: String, trim: true, default: 'Manual' },
    status: { type: String, enum: LEAD_STATUSES, default: 'New', index: true },
    estimatedValue: { type: Number, min: 0, default: 0 },
    salespersonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Salesperson', default: null, index: true },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Lead', leadSchema);
