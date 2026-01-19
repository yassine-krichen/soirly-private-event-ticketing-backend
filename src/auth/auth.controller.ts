import { Controller, Get, Post, Req, UseGuards, Body, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

/**
 * 🔐 AUTHENTICATION CONTROLLER
 * 
 * Handles user registration, login, and profile retrieval.
 * All endpoints except /auth/me are PUBLIC (no authentication required).
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
	 */
	@Post('signup')
	async signup(@Body() dto: SignupDto) {
		this.logger.log(`POST /auth/signup - Email: ${dto.email}`);
		return this.authService.signup(dto);
	}

	/**
	 * 🔑 ENDPOINT: POST /auth/signin
	 * 
	 * Login with existing account.
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
	 */
	@Post('signin')
	async signin(@Body() dto: SigninDto) {
		this.logger.log(`POST /auth/signin - Email: ${dto.email}`);
		return this.authService.signin(dto);
	}

	/**
	 * 👤 ENDPOINT: GET /auth/me
	 * 
	 * Get current authenticated user's profile.
	 * 
	 * Headers Required:
	 * Authorization: Bearer <jwt-token>
	 * 
	 * Response: User object (without password)
	 * 
	 * Errors:
	 * - 401 Unauthorized: Missing/invalid JWT token
	 * 
	 * HOW JWT WORKS:
	 * 1. User signs up/signs in → receives JWT token
	 * 2. User includes JWT in Authorization header for protected endpoints
	 * 3. JwtAuthGuard validates the token and extracts user info
	 * 4. req.user contains: { sub: userId, email: userEmail }
	 */
	@Get('me')
	@UseGuards(JwtAuthGuard)
	async me(@Req() req: any) {
		return this.authService.getProfile(req.user.sub);
	}
}
