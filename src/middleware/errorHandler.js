import multer from 'multer';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';

export const notFound = (req, _res, next) => next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));

/** Blocks data routes with a clear 503 while MongoDB is not connected. */
export const requireDb = (_req, _res, next) =>
  mongoose.connection.readyState === 1
    ? next()
    : next(new ApiError(503, 'Database is unavailable. Check that MongoDB is running and MONGO_URI is correct.'));

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let status = err.status || 500;
  let message = err.message || 'Unexpected server error';

  if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (10 MB maximum).' : `Upload error: ${err.message}`;
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join('. ');
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    message = 'A record with the same unique value already exists.';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body is not valid JSON.';
  } else if (err.name === 'MongoServerSelectionError' || err.name === 'MongoNetworkError') {
    status = 503;
    message = 'Database is unavailable. Check that MongoDB is running.';
  }

  if (status >= 500) console.error(err);
  res.status(status).json({ success: false, message: status >= 500 && status !== 503 ? 'Unexpected server error' : message });
}
