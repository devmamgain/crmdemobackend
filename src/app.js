import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { notFound, requireDb, errorHandler } from './middleware/errorHandler.js';
import { isLlmConfigured } from './services/llmService.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientUrl.split(',').map((s) => s.trim()) }));
app.use(express.json({ limit: '1mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please slow down.' },
  })
);

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    db: { connected: mongoose.connection.readyState === 1 },
    llm: { configured: isLlmConfigured(), model: isLlmConfigured() ? env.llm.model : null, mode: isLlmConfigured() ? 'live' : 'fallback' },
    fmv: { buyRatio: env.fmv.buyRatio, resaleRatio: env.fmv.resaleRatio, dataset: 'Demo market dataset' },
    time: new Date().toISOString(),
  });
});

app.use('/api', requireDb, routes);
app.use(notFound);
app.use(errorHandler);

export default app;
