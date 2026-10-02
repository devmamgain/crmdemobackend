import mongoose from 'mongoose';

const fmvAnalysisSchema = new mongoose.Schema(
  {
    salespersonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Salesperson', default: null },
    filename: { type: String, required: true },
    itemsAnalyzed: Number,
    totalQuantity: Number,
    unmatchedCount: { type: Number, default: 0 },
    estimatedMarketValue: Number,
    recommendedBuyValue: Number,
    estimatedResaleValue: Number,
    resaleRatio: Number,
    potentialMargin: Number,
    buyRatio: Number,
    items: { type: [mongoose.Schema.Types.Mixed], default: [] },
    warnings: { type: [String], default: [] },
    aiInsights: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model('FMVAnalysis', fmvAnalysisSchema);
