import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CustomLoggerService } from '../logger/custom-logger.service';

/**
 * 🌐 HTTP REQUEST/RESPONSE LOGGER MIDDLEWARE
 *
 * Logs all incoming requests and outgoing responses.
 * Captures:
 * - Request method, URL, IP address
 * - Response status code, duration
 * - User ID (if authenticated)
 *
 * Excludes:
 * - Health check endpoints (/health)
 * - Static assets
 *
 * Example Log Output:
 * 2025-01-21 10:30:45 [HTTP] info: GET /events/123 200 45ms {"userId":"user-123","ip":"127.0.0.1"}
 */
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: CustomLoggerService) {
    this.logger.setContext('HTTP');
  }

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '';
    const startTime = Date.now();

    // Skip logging for health checks
    if (originalUrl.includes('/health')) {
      return next();
    }

    // Log request
    const user = (req as any).user;
    const userId = user?.sub || 'anonymous';

    this.logger.http(`${method} ${originalUrl}`, {
      userId,
      ip,
      userAgent,
    });

    // Log response on finish
    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;

      const level =
        statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

      if (level === 'error') {
        this.logger.error(
          `${method} ${originalUrl} ${statusCode} ${duration}ms`,
          undefined,
          {
            userId,
            ip,
            statusCode,
            duration,
          },
        );
      } else if (level === 'warn') {
        this.logger.warn(
          `${method} ${originalUrl} ${statusCode} ${duration}ms`,
          {
            userId,
            ip,
            statusCode,
            duration,
          },
        );
      } else {
        this.logger.http(
          `${method} ${originalUrl} ${statusCode} ${duration}ms`,
          {
            userId,
            ip,
            statusCode,
            duration,
          },
        );
      }
    });

    next();
  }
}
