import dotenv from 'dotenv';
dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/marketflow',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  llm: {
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
    baseUrl: (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    timeoutMs: 25000,
  },
  fmv: {
    // Share of FMV we are willing to pay when acquiring inventory.
    buyRatio: Math.min(0.99, Math.max(0.1, Number(process.env.FMV_BUY_RATIO) || 0.8)),
    // Expected sell-through of FMV when remarketing (after discounts/channel fees). Resale value = FMV x this ratio.
    resaleRatio: Math.min(1.5, Math.max(0.1, Number(process.env.FMV_RESALE_RATIO) || 0.95)),
    maxRows: 500,
    maxFileBytes: 10 * 1024 * 1024,
  },
};
