import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
	constructor(private readonly prisma: PrismaService) {}

	create(inviterId: string, dto: CreateEventDto) {
		return this.prisma.event.create({
			data: {
				...dto,
				entryPrice: new Prisma.Decimal(dto.entryPrice),
				inviterId,
				// ensure private events by default, override guard rails in schema
				isPrivate: true,
			},
		});
	}

	async findOne(id: string) {
		const event = await this.prisma.event.findUnique({ where: { id } });
		if (!event) {
			throw new NotFoundException('Event not found');
		}
		return event;
	}

	async listForInviter(inviterId: string) {
		return this.prisma.event.findMany({
			where: { inviterId },
			orderBy: { createdAt: 'desc' },
		});
	}
}
