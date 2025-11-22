import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Body } from '@nestjs/common/decorators';
import { AuthService } from './auth.service';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	/**
	 * Performs Google OAuth token verification and issues a backend JWT.
	 */
	@Post('google')
	async authenticate(@Body() dto: GoogleAuthDto) {
		return this.authService.authenticateWithGoogle(dto);
	}

	/**
	 * Returns the authenticated user profile.
	 */
	@Get('me')
	@UseGuards(JwtAuthGuard)
	async me(@Req() req: any) {
		return this.authService.getProfile(req.user.sub);
	}
}
