import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import simulateRouter from './routes/simulate';

const app = express();

// Render/Vercel sit behind a proxy; needed for correct IPs & some middleware.
app.set('trust proxy', 1);

/** CORS: read a comma-separated whitelist from CORS_ORIGIN.
 *  Examples:
 *  CORS_ORIGIN=https://your-frontend.vercel.app,http://localhost:5173
 *  If not set, allow all (useful for local dev). */
const origins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: origins.length ? origins : true,
  credentials: true,
}));

// Security headers (kept permissive for SPA/API assets crossing origins).
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Gzip responses
app.use(compression());

// Request logging (pretty in dev, standard in prod)
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// JSON parsing
app.use(express.json({ limit: '1mb' }));

// Simple health check for uptime monitors
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// API routes
app.use('/api', simulateRouter);

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = Number(process.env.PORT) || 5001;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
