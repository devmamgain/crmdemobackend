import mongoose from 'mongoose';

const marketValueSchema = new mongoose.Schema(
  {
    model: { type: String, required: true, trim: true },
    normalizedModel: { type: String, required: true, unique: true, index: true },
    category: { type: String, default: 'Other' },
    brand: { type: String, default: '' },
    marketPrices: { type: [Number], default: [] }, // historical sale prices (per unit, USD)
    currentFMV: { type: Number, default: 0 },      // median of marketPrices at last refresh
    currency: { type: String, default: 'USD' },
    conditionAdjustments: {
      type: Map,
      of: Number,
      default: () => ({ Excellent: 1.1, Good: 1.0, Fair: 0.85, Poor: 0.65 }),
    },
    lastUpdated: { type: Date, default: Date.now },
    sourceType: { type: String, default: 'demo_historical_sales' },
  },
  { timestamps: false }
);

export default mongoose.model('MarketValue', marketValueSchema);
