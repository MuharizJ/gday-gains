import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import simulateRouter from './routes/simulate';

const app = express();

// Some platforms sit behind a proxy; needed for correct IPs & some middleware.
app.set('trust proxy', 1);

/**
 * CORS:
 *  - Read a comma-separated whitelist from CORS_ORIGIN.
 *  - If not set, allow all (useful for local dev).
 *  - Add Vary: Origin so caches behave.
 */
const origins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: origins.length ? origins : true,
  credentials: true,
}));

app.use((req, res, next) => {
  res.header('Vary', 'Origin');
  next();
});

// Security headers (kept permissive for SPA/API assets crossing origins).
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Gzip responses
app.use(compression());

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// JSON parsing
app.use(express.json({ limit: '1mb' }));

// Health checks
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.get('/api/ping', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// API routes
app.use('/api', simulateRouter);

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = Number(process.env.PORT) || 5001;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
