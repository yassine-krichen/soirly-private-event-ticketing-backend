import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const config = app.get(ConfigService);

  // ============================================
  // SECURITY: Helmet - HTTP Security Headers
  // ============================================
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      frameguard: {
        action: 'deny',
      },
    }),
  );

  // ============================================
  // SECURITY: CORS Configuration
  // ============================================
  const allowedOrigins = config
    .get<string>('ALLOWED_ORIGINS')
    ?.split(',')
    .map((origin) => origin.trim());

  app.enableCors({
    origin: allowedOrigins || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-konnect-signature'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400, // 24 hours preflight cache
  });

  logger.log(`🔒 CORS enabled for origins: ${allowedOrigins?.join(', ')}`);

  // ============================================
  // VALIDATION: Global Validation Pipe
  // ============================================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error if extra properties
      transform: true, // Auto-transform types
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ============================================
  // START SERVER
  // ============================================
  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);

  logger.log(`🚀 Server is running on http://localhost:${port}`);
  logger.log(`🔒 Security headers enabled (Helmet)`);
  logger.log(`🚦 Rate limiting enabled (Throttler)`);
  logger.log(`✅ Environment validation passed`);
}

bootstrap();
