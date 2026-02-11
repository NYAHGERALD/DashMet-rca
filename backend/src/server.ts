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

dotenv.config();
console.log('✅ Environment loaded');
console.log('🔑 DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('🔑 JWT_SECRET exists:', !!process.env.JWT_SECRET);

import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { rateLimiter } from './middleware/rateLimiter';
console.log('✅ Middleware loaded');

import routes from './routes';
console.log('✅ Routes loaded');

import { websocketService } from './services/websocketService';
console.log('✅ WebSocket service loaded');

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

// ==================== PHASE 0.1: SECURITY & MIDDLEWARE ====================

// CORS configuration - MUST be before other middleware
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'https://localhost:3000',
    'https://localhost:3001',
    'https://localhost:3002',
    'http://192.168.1.217:3000',
    'https://192.168.1.217:3000',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 hours
};

// Apply CORS before everything else
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// Body parsing - increased limits for large audio transcripts
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Request logging
app.use(requestLogger);

// Rate limiting (Phase 0.4)
app.use('/api/', rateLimiter);

// Serve static files from uploads directory with CORS headers
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Cache-Control', 'public, max-age=31536000');
  next();
}, express.static(path.join(__dirname, '..', 'uploads')));

// Health check endpoint (for Render and monitoring)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Also expose at /api/health for Render
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
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

// Start server - bind to 0.0.0.0 to allow network access
const HOST = process.env.HOST || '0.0.0.0';
const server = httpServer.listen(PORT, HOST, () => {
  console.log(`🚀 RCA Engine API Server running on http://${HOST}:${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌍 CORS enabled for:`, corsOptions.origin);
  console.log(`🔌 WebSocket server ready`);
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

