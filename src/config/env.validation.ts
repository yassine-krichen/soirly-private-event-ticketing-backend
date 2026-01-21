import * as Joi from 'joi';

/**
 * Environment Variables Validation Schema
 *
 * Validates all required environment variables on application startup.
 * App will crash with descriptive error if any required vars are missing/invalid.
 */
export const envValidationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  PORT: Joi.number().port().default(3000),

  // Database
  DATABASE_URL: Joi.string()
    .required()
    .description('PostgreSQL connection string'),

  // JWT Authentication
  JWT_SECRET: Joi.string()
    .min(32)
    .required()
    .description('JWT signing secret (minimum 32 characters)'),

  JWT_EXPIRES_IN: Joi.string()
    .default('7d')
    .description('JWT expiration time (e.g., 7d, 24h)'),

  // Google OAuth
  GOOGLE_CLIENT_ID: Joi.string()
    .required()
    .description('Google OAuth Client ID'),

  // Konnect Payment Gateway
  KONNECT_API_KEY: Joi.string().required().description('Konnect API key'),

  KONNECT_BASE_URL: Joi.string()
    .uri()
    .required()
    .description('Konnect API base URL'),

  KONNECT_WEBHOOK_SECRET: Joi.string()
    .required()
    .description('Konnect webhook signature secret'),

  KONNECT_WALLET_ID: Joi.string()
    .optional()
    .description('Konnect wallet ID for payments'),

  APP_FEE_PERCENT: Joi.number()
    .min(0)
    .max(100)
    .default(0)
    .description('Platform fee percentage'),

  // CORS
  ALLOWED_ORIGINS: Joi.string()
    .required()
    .description('Comma-separated list of allowed origins'),

  // Optional: Redis (if caching is added later)
  REDIS_HOST: Joi.string().optional().default('localhost'),

  REDIS_PORT: Joi.number().port().optional().default(6379),

  // Optional: Monitoring
  SENTRY_DSN: Joi.string()
    .uri()
    .optional()
    .description('Sentry error tracking DSN'),
});

/**
 * Validation Options
 */
export const envValidationOptions = {
  abortEarly: false, // Show all validation errors at once
  allowUnknown: true, // Allow extra env vars
};
