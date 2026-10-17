// backend/src/app.ts
import 'express-async-errors';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

// Routes
import authRouter from './routes/auth';
import productRouter from './routes/products';
import meRouter from './routes/me';
import walletRouter from './routes/wallet';
import packageRouter from './routes/package';
import savingsRouter from './routes/savings';
import paymentRouter from './routes/payments';
import adminRouter from './routes/admin';
import emailRouter from './routes/email';

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
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.endsWith('.vercel.app') ||
        origin === process.env.CORS_ORIGIN
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Path Normalization ────────────────────────────────────────────────────────
// If proxy or serverless strips /api from /api/v1/...
app.use((req, _res, next) => {
  if (req.url.startsWith('/v1/')) {
    req.url = '/api' + req.url;
  }
  next();
});

// ─── API Routes ────────────────────────────────────────────────────────────────
const API = '/api/v1';

// Unified Auth routes (supports /api/auth, /auth, /api/v1/auth)
app.use(['/api/auth', '/auth', `${API}/auth`], authRouter);
app.use(`${API}/products`, productRouter);
app.use(`${API}/me`, meRouter);
app.use(`${API}/wallet`, walletRouter);
app.use(`${API}/packages`, packageRouter);
app.use(`${API}/savings`, savingsRouter);
app.use(`${API}/payments`, paymentRouter);
app.use(`${API}/admin`, adminRouter);
app.use(`${API}/email`, emailRouter);

// Public delivery fee endpoint for customer checkout
app.get(['/delivery-fee', '/api/delivery-fee', `${API}/delivery-fee`], async (_req: Request, res: Response) => {
  const { getDeliveryFeeConfig } = await import('./services/deliveryFee.service');
  res.json(getDeliveryFeeConfig());
});

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get(['/health', '/api/health', '/api/v1/health'], (_req: Request, res: Response) => {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      DATABASE_URL: dbUrl ? `SET (${dbUrl.split('@').pop()?.split('/')[0] || 'host hidden'})` : 'NOT SET ⚠️',
      JWT_SECRET: process.env.JWT_SECRET ? 'SET ✓' : 'NOT SET ⚠️',
      CORS_ORIGIN: process.env.CORS_ORIGIN || 'not set',
    },
  });
});

// ─── Diagnostics (safe — no secrets exposed) ───────────────────────────────────
app.get(['/api/v1/diagnostics', '/api/diagnostics'], async (_req: Request, res: Response) => {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
  let dbPing: string;
  try {
    const prisma = (await import('./prisma/client')).default;
    await (prisma as any).$queryRaw`SELECT 1`;
    dbPing = 'connected ✓';
  } catch (e: any) {
    dbPing = `failed: ${e.message}`;
  }
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      DATABASE_URL: dbUrl ? 'SET ✓' : 'NOT SET ⚠️',
      JWT_SECRET: process.env.JWT_SECRET ? 'SET ✓' : 'NOT SET ⚠️',
      NODE_ENV: process.env.NODE_ENV || 'not set',
    },
    database: dbPing,
  });
});

// ─── 404 Catch-all ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found', code: 'NOT_FOUND' });
});

// ─── Central Error Handler ─────────────────────────────────────────────────────
// Must be registered LAST – after all routes
app.use(errorHandler);

export default app;
