// Immediate startup logging
console.log('🚀 Server starting...');
console.log('📁 Current directory:', process.cwd());
console.log('🔧 Node version:', process.version);

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';

console.log('✅ Core imports loaded');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
console.log('✅ Environment loaded');
console.log('📂 .env path:', path.resolve(__dirname, '../../.env'));
console.log('🔑 DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('🔑 JWT_SECRET exists:', !!process.env.JWT_SECRET);

import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { rateLimiter } from './middleware/rateLimiter';
import { requestId } from './middleware/requestId';
import { securityHeaders } from './middleware/securityHeaders';
import { sanitizeInputs } from './middleware/inputSanitizer';
import hpp from 'hpp';
console.log('✅ Middleware loaded');

import routes from './routes';
console.log('✅ Routes loaded');

import { websocketService } from './services/websocketService';
console.log('✅ WebSocket service loaded');

import { startAutoWeekCron } from './services/bakeryAutoWeekCron';
console.log('✅ AutoWeek cron loaded');

// Add comprehensive error handling
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const app: Application = express();
const PORT = parseInt(process.env.PORT || '5001', 10);
console.log('✅ Express app created, PORT:', PORT);

// ==================== SECURITY & MIDDLEWARE ====================

// Trust the first proxy (Render reverse proxy) — required for:
// - Correct client IP in rate limiting (req.ip)
// - Correct protocol detection (req.protocol / x-forwarded-proto)
// - Correct host detection (x-forwarded-host)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// HTTPS enforcement in production — redirect all HTTP requests
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
    return res.redirect(301, `https://${req.header('host')}${req.url}`);
  }
  next();
});

// Request ID tracking for every request
app.use(requestId);

// CORS configuration — strict origin allowlist
const ALLOWED_ORIGINS: string[] = (() => {
  if (process.env.NODE_ENV === 'production') {
    return (process.env.CORS_ORIGIN || '').split(',').filter(Boolean);
  }
  return [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'https://localhost:3000',
    'https://localhost:3001',
    'https://localhost:3002',
  ];
})();

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, server-to-server, curl in dev)
    if (!origin) {
      return callback(null, true);
    }
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('CORS: Origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range', 'X-Request-Id'],
  maxAge: 3600, // 1 hour (not 24 hours)
};

// Apply CORS before everything else
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Security headers (Helmet)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://firebasestorage.googleapis.com", "https://*.googleusercontent.com"],
      connectSrc: ["'self'", "https://dashmet-rca-api.onrender.com", "wss://dashmet-rca-api.onrender.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// Additional security headers
app.use(securityHeaders);

// Prevent HTTP Parameter Pollution
app.use(hpp());

// Body parsing — enforced size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization (XSS protection)
app.use(sanitizeInputs);

// Request logging
app.use(requestLogger);

// Rate limiting
app.use('/api/', rateLimiter);

// Serve static files from uploads directory — no wildcard CORS
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Cache-Control', 'private, max-age=3600');
  next();
}, express.static(path.join(__dirname, '..', 'uploads')));

// Health check endpoint — minimal info (no version, uptime, or internals)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// ==================== PHASE 0.1: BASE ROUTING ====================
app.use('/api', routes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Create HTTP server for both Express and WebSocket
const httpServer = createServer(app);

// Initialize WebSocket server
const corsOriginsArray = Array.isArray(corsOptions.origin) ? corsOptions.origin : [corsOptions.origin];
websocketService.initialize(httpServer, corsOriginsArray as string[]);

// Initialize Yjs WebSocket server for Canvas AI whiteboard collaboration
import { initializeYjsWebSocket } from './services/yjsService';
initializeYjsWebSocket(httpServer);

// Start server - bind to 0.0.0.0 to allow network access
const HOST = process.env.HOST || '0.0.0.0';
const server = httpServer.listen(PORT, HOST, () => {
  console.log(`🚀 RCA Engine API Server running on http://${HOST}:${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌍 CORS enabled for:`, corsOptions.origin);
  console.log(`🔌 WebSocket server ready`);

  // Start auto-week cron job
  startAutoWeekCron();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

export default app;

