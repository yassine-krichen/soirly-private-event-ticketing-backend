import { Injectable } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

interface UpsertGoogleUserArgs {
	email: string;
	name: string;
	role: UserRole;
}

@Injectable()
export class UsersService {
	constructor(private readonly prisma: PrismaService) {}

	async findById(id: string) {
		return this.prisma.user.findUnique({ where: { id } });
	}

	async upsertGoogleUser(args: UpsertGoogleUserArgs): Promise<User> {
		const existing = await this.prisma.user.findUnique({ where: { email: args.email } });
		if (existing) {
			if (args.role && existing.role !== args.role) {
				return this.prisma.user.update({
					where: { id: existing.id },
					data: { name: args.name, role: args.role },
				});
			}
			if (existing.name !== args.name) {
				return this.prisma.user.update({
					where: { id: existing.id },
					data: { name: args.name },
				});
			}
			return existing;
		}

		return this.prisma.user.create({
			data: {
				email: args.email,
				name: args.name,
				role: args.role ?? UserRole.INVITEE,
				oauthProvider: 'google',
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
