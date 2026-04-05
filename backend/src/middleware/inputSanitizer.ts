import { Request, Response, NextFunction } from 'express';

// Strip dangerous characters from string inputs to prevent XSS
function sanitizeValue(value: any): any {
  if (typeof value === 'string') {
    return value
      .replace(/<script[\s>]/gi, '')        // Strip script tags
      .replace(/javascript:/gi, '')          // Strip JS protocol
      .replace(/on(error|load|click|mouseover|focus|blur|submit|change|input|keydown|keyup|keypress)\s*=/gi, '') // Strip event handlers
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object' && !(value instanceof Buffer)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sanitizeValue(v)])
    );
  }
  return value;
}

export const sanitizeInputs = (req: Request, res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeValue(req.query) as any;
  }
  next();
};
