import mongoose from 'mongoose';
import { DEAL_STAGES, PRIORITIES } from '../utils/validate.js';

const dealSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    serviceType: { type: String, default: 'IT Asset Recovery' },
    assetCount: { type: Number, min: 0, default: 0 },
    value: { type: Number, min: 0, default: 0 },
    stage: { type: String, enum: DEAL_STAGES, default: 'New', index: true },
    salespersonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Salesperson', default: null, index: true },
    priority: { type: String, enum: PRIORITIES, default: 'Medium' },
    expectedCloseDate: { type: Date, default: null },
    description: { type: String, default: '' },
    // Set when a deal enters Won/Lost. Drives "revenue over time" in reports.
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('Deal', dealSchema);
