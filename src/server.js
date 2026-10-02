import app from './app.js';
import { env } from './config/env.js';
import { connectDb } from './config/db.js';

app.listen(env.port, () => console.log(`[server] API listening on http://localhost:${env.port}/api`));
connectDb();
