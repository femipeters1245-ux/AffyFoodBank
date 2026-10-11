// backend/src/app.ts
import 'express-async-errors';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Routes
import authRouter from './routes/auth';
import productRouter from './routes/products';
import meRouter from './routes/me';
import walletRouter from './routes/wallet';
import packageRouter from './routes/package';
import savingsRouter from './routes/savings';
import paymentRouter from './routes/payments';

// Middleware
import errorHandler from './middleware/errorHandler';

dotenv.config();

// Enable JSON serialization of BigInt fields returned by Prisma
(BigInt.prototype as any).toJSON = function () {
  const int = Number(this);
  return Number.isSafeInteger(int) ? int : this.toString();
};

const app = express();

// ─── Global Middlewares ────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── API Routes ────────────────────────────────────────────────────────────────
const API = '/api/v1';

app.use(`${API}/auth`, authRouter);
app.use(`${API}/products`, productRouter);
app.use(`${API}/me`, meRouter);
app.use(`${API}/wallet`, walletRouter);
app.use(`${API}/packages`, packageRouter);
app.use(`${API}/savings`, savingsRouter);
app.use(`${API}/payments`, paymentRouter);

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 Catch-all ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND' });
});

// ─── Central Error Handler ─────────────────────────────────────────────────────
// Must be registered LAST – after all routes
app.use(errorHandler);

export default app;
