import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import { UsersService } from '../users/users.service';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
	private readonly googleClient: OAuth2Client;
	private readonly googleClientId: string;

	constructor(
		private readonly usersService: UsersService,
		private readonly jwtService: JwtService,
		configService: ConfigService,
	) {
		this.googleClientId = configService.get<string>('GOOGLE_CLIENT_ID', 'env-google-client-id');
		this.googleClient = new OAuth2Client(this.googleClientId);
	}

	async authenticateWithGoogle(dto: GoogleAuthDto) {
		const ticket = await this.googleClient.verifyIdToken({
			idToken: dto.token,
			audience: this.googleClientId,
		});

		const payload = ticket.getPayload();
		if (!payload || !payload.email) {
			throw new UnauthorizedException('Invalid Google token');
		}

		const user = await this.usersService.upsertGoogleUser({
			email: payload.email,
			name: payload.name ?? payload.email.split('@')[0],
			role: dto.role ?? UserRole.INVITEE,
		});

		return {
			jwt: this.createToken(user),
			user,
		};
	}

	async getProfile(userId: string): Promise<User> {
		const user = await this.usersService.findById(userId);
		if (!user) {
			throw new UnauthorizedException('User not found');
		}

		return user;
	}

	private createToken(user: User) {
		const payload: JwtPayload = {
			sub: user.id,
			email: user.email,
			role: user.role,
		};
		return this.jwtService.sign(payload);
	}
}
