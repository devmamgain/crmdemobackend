import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

/** Connects with retry so the API can boot (and report "db disconnected") before MongoDB is up. */
export async function connectDb({ retryMs = 5000 } = {}) {
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('[db] MongoDB connected');
  } catch (err) {
    console.error(`[db] MongoDB connection failed: ${err.message}. Retrying in ${retryMs / 1000}s...`);
    setTimeout(() => connectDb({ retryMs }), retryMs);
  }
}
