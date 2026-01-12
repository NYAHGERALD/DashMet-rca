import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

// Log Prisma queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query' as never, (e: any) => {
    logger.debug(`Query: ${e.query}`);
  });
}

prisma.$on('error' as never, (e: any) => {
  logger.error(`Prisma Error: ${e.message}`);
});

prisma.$on('warn' as never, (e: any) => {
  logger.warn(`Prisma Warning: ${e.message}`);
});

export { prisma };
