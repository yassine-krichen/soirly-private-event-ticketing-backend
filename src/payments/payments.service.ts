import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { KonnectWebhookDto } from './dto/konnect-webhook.dto';
import { KonnectService } from './konnect.service';

interface RequestUser {
	sub: string;
	email: string;
}

@Injectable()
export class PaymentsService {
	private readonly logger = new Logger(PaymentsService.name);
	private readonly webhookSecret: string;
	private readonly appFeePercent: number;

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventsService: EventsService,
		private readonly konnectService: KonnectService,
		configService: ConfigService,
	) {
		this.webhookSecret = configService.get<string>('KONNECT_WEBHOOK_SECRET', 'konnect-webhook-secret');
		this.appFeePercent = Number(configService.get<string>('APP_FEE_PERCENT', '5'));
	}

	async createPayment(user: RequestUser, dto: CreatePaymentDto) {
		const event = await this.eventsService.findOne(dto.eventId);
		if (event.inviterId === user.sub) {
			throw new BadRequestException('Inviters cannot pay for their own events');
		}

		const entryPrice = Number(event.entryPrice);
		const appFee = Number(((entryPrice * this.appFeePercent) / 100).toFixed(2));
		const total = entryPrice + appFee;
		const konnectReference = randomUUID();

		const payment = await this.prisma.payment.create({
			data: {
				eventId: event.id,
				userId: user.sub,
				amount: new Prisma.Decimal(entryPrice),
				appFee: new Prisma.Decimal(appFee),
				konnectReference,
				konnectPaymentUrl: null,
				status: PaymentStatus.PENDING,
			},
		});

		const session = await this.konnectService.createSession({
			reference: konnectReference,
			amount: total,
			customerEmail: user.email,
			title: `Event ${event.title}`,
		});

		await this.prisma.payment.update({
			where: { id: payment.id },
			data: { konnectPaymentUrl: session.paymentUrl },
		});

		return {
			paymentId: payment.id,
			paymentUrl: session.paymentUrl,
			konnectReference,
		};
	}

	async getStatus(paymentId: string) {
		return this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
	}

	async processWebhook(signature: string | undefined, payload: KonnectWebhookDto) {
		if (signature !== this.webhookSecret) {
			throw new ForbiddenException('Invalid webhook signature');
		}

		const payment = await this.prisma.payment.findUnique({
			where: { konnectReference: payload.reference },
		});

		if (!payment) {
			this.logger.warn(`Webhook received for unknown reference ${payload.reference}`);
			return { success: false };
		}

		if (payment.status === payload.status) {
			return { success: true };
		}

		await this.prisma.$transaction(async (tx) => {
			await tx.payment.update({
				where: { id: payment.id },
				data: { status: payload.status },
			});

			if (payload.status === PaymentStatus.SUCCESS) {
				await this.eventsService.incrementInviteeCount(payment.eventId, tx);
			}
		});

		return { success: true };
	}
}
