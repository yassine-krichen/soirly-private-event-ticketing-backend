import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
	private readonly logger = new Logger(AuthService.name);

	constructor(
		private readonly usersService: UsersService,
		private readonly jwtService: JwtService,
		configService: ConfigService,
	) {}

	async signup(dto: SignupDto) {
		this.logger.log(`Signup attempt for email: ${dto.email}`);
		
		// Check if user already exists
		const existingUser = await this.usersService.findByEmail(dto.email);
		if (existingUser) {
			this.logger.warn(`Signup failed: User with email ${dto.email} already exists`);
			throw new ConflictException('User with this email already exists');
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(dto.password, 10);

		// Create user
		const user = await this.usersService.createUser({
			email: dto.email,
			password: hashedPassword,
			name: dto.name,
		});

		this.logger.log(`User successfully created: ${user.email}`);

		return {
			jwt: this.createToken(user),
			user: this.sanitizeUser(user),
		};
	}

	async signin(dto: SigninDto) {
		this.logger.log(`Signin attempt for email: ${dto.email}`);
		
		// Find user by email
		const user = await this.usersService.findByEmail(dto.email);
		if (!user || !user.password) {
			this.logger.warn(`Signin failed: Invalid credentials for ${dto.email}`);
			throw new UnauthorizedException('Invalid credentials');
		}

		// Verify password
		const isPasswordValid = await bcrypt.compare(dto.password, user.password);
		if (!isPasswordValid) {
			this.logger.warn(`Signin failed: Invalid password for ${dto.email}`);
			throw new UnauthorizedException('Invalid credentials');
		}

		this.logger.log(`User successfully signed in: ${user.email}`);

		return {
			jwt: this.createToken(user),
			user: this.sanitizeUser(user),
		};
	}

	async getProfile(userId: string): Promise<User> {
		const user = await this.usersService.findById(userId);
		if (!user) {
			throw new UnauthorizedException('User not found');
		}

		return this.sanitizeUser(user);
	}

	private createToken(user: User) {
		const payload: JwtPayload = {
			sub: user.id,
			email: user.email,
		};
		return this.jwtService.sign(payload);
	}

	private sanitizeUser(user: User): any {
		const { password, ...userWithoutPassword } = user;
		return userWithoutPassword;
	}
}
