import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { config } from './config.js';
import { initDatabase } from './db/index.js';
import { authMiddleware } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';
import { distanceLearningRouter } from './routes/distanceLearning.js';
import { parkingRouter } from './routes/parking.js';
import { absenceRouter } from './routes/absence.js';
import { mediaRouter } from './routes/media.js';
import { streamingRouter } from './routes/streaming.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Basic security & parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// CORS config
app.use(cors({
  origin: true,
  credentials: true,
}));

// Global auth & impersonation context middleware
app.use(authMiddleware);

// Public branding, home/login content & portal-config.js
app.use(publicRouter);

// Feature & Auth API routes
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/distance-learning', distanceLearningRouter);
app.use('/api/parking', parkingRouter);
app.use('/api/absence', absenceRouter);
app.use('/api/streaming', streamingRouter);
app.use('/api/media', mediaRouter);

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: '1.0.0',
  });
});

// Unsupported API methods return 405 Method Not Allowed per Section 2
app.all('/api/*', (_req: Request, res: Response) => {
  res.status(405).json({ error: 'Method Not Allowed' });
});

// Serve frontend static assets
const distPath = path.resolve(__dirname, '..', '..', 'dist');
app.use(express.static(distPath));

// Clean URL routing: Map portal routes to index.html for Single Page Application
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      // In development when dist isn't built yet, provide an informative HTML message
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>JESS Dubai Portal</title></head>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1 style="color: #002B49;">JESS Dubai Portal - API Server Running</h1>
            <p>API endpoints are active on <code>/api</code>.</p>
            <p>To run the React frontend in development mode, start Vite with <code>npm run dev:client</code>.</p>
            <p>For production deployment, run <code>npm run build</code> first.</p>
          </body>
        </html>
      `);
    }
  });
});

// Central error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(500).json({ error: err.message || 'An unexpected server error occurred' });
});

async function startServer() {
  await initDatabase();

  app.listen(config.port, () => {
    console.log(`=================================================`);
    console.log(` JESS Dubai Enterprise Portal Server`);
    console.log(` Running on port: http://localhost:${config.port}`);
    console.log(` Environment:     ${config.nodeEnv}`);
    console.log(`=================================================`);
  });
}

// Only start when invoked directly
if (process.env.NODE_ENV !== 'test') {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export { app };
