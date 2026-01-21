import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import * as path from 'path';

/**
 * 📝 CUSTOM WINSTON LOGGER
 *
 * Provides structured logging with multiple transports:
 * - Console (development): Pretty-printed colorized logs
 * - File (production): JSON logs with rotation
 *
 * Log Levels:
 * - error: Critical errors requiring immediate attention
 * - warn: Warning conditions (non-critical issues)
 * - info: General informational messages
 * - http: HTTP request/response logs
 * - debug: Detailed debugging information
 *
 * Usage:
 * constructor(private logger: CustomLoggerService) {}
 * this.logger.setContext('MyService');
 * this.logger.log('User created', { userId: '123', email: 'test@example.com' });
 * this.logger.error('Payment failed', { paymentId: '456', error: err.message });
 */
@Injectable()
export class CustomLoggerService implements LoggerService {
  private logger: winston.Logger;
  private context: string;

  constructor() {
    this.context = 'App';

    // Define log format
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json(),
    );

    // Console format (colorized for development)
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(
        ({ timestamp, level, message, context, ...meta }) => {
          const ctx = context || this.context || 'App';
          const metaStr = Object.keys(meta).length
            ? JSON.stringify(meta, null, 2)
            : '';
          return `${timestamp} [${ctx}] ${level}: ${message} ${metaStr}`;
        },
      ),
    );

    // Create Winston logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      transports: [
        // Console transport (always enabled)
        new winston.transports.Console({
          format: consoleFormat,
        }),

        // File transports (production)
        new winston.transports.File({
          filename: path.join('logs', 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: path.join('logs', 'combined.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
      ],
    });
  }

  /**
   * Set context for all subsequent logs
   */
  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Log informational message
   */
  log(message: string, meta?: any): void {
    this.logger.info(message, { context: this.context, ...meta });
  }

  /**
   * Log error message with stack trace
   */
  error(message: string, trace?: string, meta?: any): void {
    this.logger.error(message, {
      context: this.context,
      trace,
      ...meta,
    });
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: any): void {
    this.logger.warn(message, { context: this.context, ...meta });
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, meta?: any): void {
    this.logger.debug(message, { context: this.context, ...meta });
  }

  /**
   * Log verbose message (detailed info)
   */
  verbose(message: string, meta?: any): void {
    this.logger.verbose(message, { context: this.context, ...meta });
  }

  /**
   * Log HTTP request/response
   */
  http(message: string, meta?: any): void {
    this.logger.http(message, { context: this.context, ...meta });
  }
}
