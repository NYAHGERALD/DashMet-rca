/**
 * Prompt Injection Detection Middleware
 * 
 * Scans incoming request bodies for prompt injection patterns before
 * they reach AI service endpoints. Logs suspicious requests and
 * optionally blocks high-confidence injection attempts.
 */

import { Request, Response, NextFunction } from 'express';
import { detectPromptInjection } from '../utils/promptSanitizer';

// Thresholds
const BLOCK_THRESHOLD = 5; // Block if this many patterns detected in a single field
const WARN_THRESHOLD = 2;  // Warn if this many patterns detected

/**
 * Recursively scan all string values in an object for injection patterns
 */
function scanObject(obj: any, path: string = ''): Array<{ path: string; value: string; detections: string[] }> {
  const results: Array<{ path: string; value: string; detections: string[] }> = [];

  if (!obj || typeof obj !== 'object') return results;

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (typeof value === 'string' && value.length > 10) {
      const detections = detectPromptInjection(value);
      if (detections.length > 0) {
        results.push({
          path: currentPath,
          value: value.substring(0, 200), // Only log first 200 chars
          detections,
        });
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'string' && item.length > 10) {
          const detections = detectPromptInjection(item);
          if (detections.length > 0) {
            results.push({
              path: `${currentPath}[${index}]`,
              value: item.substring(0, 200),
              detections,
            });
          }
        } else if (typeof item === 'object') {
          results.push(...scanObject(item, `${currentPath}[${index}]`));
        }
      });
    } else if (typeof value === 'object') {
      results.push(...scanObject(value, currentPath));
    }
  }

  return results;
}

/**
 * Middleware to detect and log prompt injection attempts in request bodies.
 * 
 * - Logs warnings for suspicious patterns
 * - Blocks requests with high-confidence injection attempts
 * - Does NOT modify or sanitize the body (that's done at the service layer)
 */
export const promptInjectionDetector = (req: Request, res: Response, next: NextFunction) => {
  if (!req.body || typeof req.body !== 'object') {
    return next();
  }

  const scanResults = scanObject(req.body);

  if (scanResults.length === 0) {
    return next();
  }

  // Find the maximum number of detections on any single field
  const maxDetections = Math.max(...scanResults.map(r => r.detections.length));
  const allDetections = scanResults.flatMap(r => r.detections);
  const uniqueDetections = [...new Set(allDetections)];

  // Log the detection
  const userId = (req as any).user?.uid || 'anonymous';
  const userEmail = (req as any).user?.email || 'unknown';

  console.warn(
    `[PromptInjection] ⚠️ Suspicious input detected\n` +
    `  User: ${userEmail} (${userId})\n` +
    `  Endpoint: ${req.method} ${req.originalUrl}\n` +
    `  Patterns: [${uniqueDetections.join(', ')}]\n` +
    `  Fields: ${scanResults.map(r => `${r.path} (${r.detections.length} patterns)`).join(', ')}`
  );

  // Block if high-confidence injection
  if (maxDetections >= BLOCK_THRESHOLD) {
    console.error(
      `[PromptInjection] 🔴 BLOCKED - High-confidence injection attempt\n` +
      `  User: ${userEmail} (${userId})\n` +
      `  Endpoint: ${req.method} ${req.originalUrl}\n` +
      `  Max patterns in single field: ${maxDetections}\n` +
      `  Details: ${JSON.stringify(scanResults.map(r => ({ path: r.path, detections: r.detections })))}`
    );

    return res.status(400).json({
      error: 'Invalid input detected',
      message: 'Your request contains content that cannot be processed. Please revise your input.'
    });
  }

  // Warn but allow through — sanitization at the service layer will clean it
  if (maxDetections >= WARN_THRESHOLD) {
    console.warn(
      `[PromptInjection] 🟡 WARNING - Moderate injection patterns detected, proceeding with sanitization\n` +
      `  Details: ${JSON.stringify(scanResults.map(r => ({ path: r.path, detections: r.detections })))}`
    );
  }

  next();
};
