import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

interface CreateUserArgs {
	email: string;
	password: string;
	name?: string;
}

@Injectable()
export class UsersService {
	constructor(private readonly prisma: PrismaService) {}

	async findById(id: string) {
		return this.prisma.user.findUnique({ where: { id } });
	}

	async findByEmail(email: string) {
		return this.prisma.user.findUnique({ where: { email } });
	}

	async createUser(args: CreateUserArgs): Promise<User> {
		return this.prisma.user.create({
			data: {
				email: args.email,
				password: args.password,
				name: args.name,
			},
		});
	}

	async findEventsByInviter(inviterId: string) {
		return this.prisma.event.findMany({
			where: { inviterId },
			orderBy: { createdAt: 'desc' },
		});
	}
}
