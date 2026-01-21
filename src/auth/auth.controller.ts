import {
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  Body,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

/**
 * 🔐 AUTHENTICATION CONTROLLER
 *
 * Handles user registration, login, and profile retrieval.
 * All endpoints except /auth/me are PUBLIC (no authentication required).
 *
 * RATE LIMITING:
 * - Signup: 3 requests per hour (prevent spam accounts)
 * - Signin: 5 requests per minute (prevent brute force)
 * - Me: 20 requests per minute (normal usage)
 */
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * 📝 ENDPOINT: POST /auth/signup
   *
   * Register a new user account.
   *
   * RATE LIMIT: 3 requests per hour per IP
   *
   * Request Body:
   * {
   *   "email": "user@example.com",
   *   "password": "password123",
   *   "name": "John Doe" (optional)
   * }
   *
   * Response:
   * {
   *   "jwt": "eyJhbGciOiJIUzI1...",  // Use this for authenticated requests
   *   "user": {
   *     "id": "uuid",
   *     "email": "user@example.com",
   *     "name": "John Doe",
   *     "role": "USER",
   *     "isActive": true
   *   }
   * }
   *
   * Errors:
   * - 409 Conflict: Email already exists
   * - 400 Bad Request: Invalid email/password format
   * - 429 Too Many Requests: Rate limit exceeded
   */
  @Post('signup')
  @Throttle({ short: { limit: 3, ttl: 3600000 } }) // 3 per hour
  async signup(@Body() dto: SignupDto) {
    this.logger.log(`POST /auth/signup - Email: ${dto.email}`);
    return this.authService.signup(dto);
  }

  /**
   * 🔑 ENDPOINT: POST /auth/signin
   *
   * Login with existing account.
   *
   * RATE LIMIT: 5 requests per minute per IP (prevent brute force)
   *
   * Request Body:
   * {
   *   "email": "user@example.com",
   *   "password": "password123"
   * }
   *
   * Response: Same as /signup (returns JWT + user object)
   *
   * Errors:
   * - 401 Unauthorized: Invalid credentials
   * - 429 Too Many Requests: Rate limit exceeded (too many failed attempts)
   */
  @Post('signin')
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 per minute
  async signin(@Body() dto: SigninDto) {
    this.logger.log(`POST /auth/signin - Email: ${dto.email}`);
    return this.authService.signin(dto);
  }

  /**
   * 👤 ENDPOINT: GET /auth/me
   *
   * Get current authenticated user's profile.
   *
   * RATE LIMIT: 20 requests per minute
   *
   * Headers Required:
   * Authorization: Bearer <jwt-token>
   *
   * Response: User object (without password)
   *
   * Errors:
   * - 401 Unauthorized: Missing/invalid JWT token
   * - 429 Too Many Requests: Rate limit exceeded
   *
   * HOW JWT WORKS:
   * 1. User signs up/signs in → receives JWT token
   * 2. User includes JWT in Authorization header for protected endpoints
   * 3. JwtAuthGuard validates the token and extracts user info
   * 4. req.user contains: { sub: userId, email: userEmail }
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @Throttle({ medium: { limit: 20, ttl: 60000 } }) // 20 per minute
  async me(@Req() req: any) {
    return this.authService.getProfile(req.user.sub);
  }
}
