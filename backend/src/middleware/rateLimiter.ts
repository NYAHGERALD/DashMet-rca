import rateLimit from 'express-rate-limit';

// Phase 0.4: Rate Limiting
export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || (process.env.NODE_ENV === 'production' ? '100' : '10000')), // Much higher for development
  message: {
    success: false,
    error: 'Rate limited, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for certain endpoints in development
  skip: (req) => {
    if (process.env.NODE_ENV !== 'production') {
      // Skip rate limiting for frequently called endpoints in development
      const skipPaths = ['/api/firebase-auth/me', '/api/health'];
      return skipPaths.some(path => req.path.includes(path.replace('/api', '')));
    }
    return false;
  },
});

// Stricter rate limit for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 50 : 10000, // 10000 for dev (essentially disabled for testing)
  skipFailedRequests: false, // Count all requests to prevent abuse
  skipSuccessfulRequests: false, // Count all requests
  message: {
    success: false,
    error: {
      message: 'Too many login attempts, please try again later.',
    },
  },
});
