import { Injectable, BadRequestException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { InvitationsService } from '../invitations/invitations.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { KonnectWebhookDto } from './dto/konnect-webhook.dto';
import { PaymentProviderFactory } from './providers/payment-provider.factory';

interface RequestUser {
	sub: string;
	email: string;
}

/**
 * 💳 PAYMENTS SERVICE
 * 
 * Handles payment creation, status checks, and webhook processing.
 * NOW PROPERLY LINKED TO INVITATION SYSTEM! ✅
 */
@Injectable()
export class PaymentsService {
	private readonly logger = new Logger(PaymentsService.name);
	private readonly webhookSecret: string;
	private readonly appFeePercent: number;

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventsService: EventsService,
		private readonly invitationsService: InvitationsService,
		private readonly paymentProviderFactory: PaymentProviderFactory,
		private readonly configService: ConfigService,
	) {
		this.webhookSecret = configService.get<string>('KONNECT_WEBHOOK_SECRET', 'konnect-webhook-secret');
		this.appFeePercent = Number(configService.get<string>('APP_FEE_PERCENT', '5'));
	}

	/**
	 * 💰 CREATE PAYMENT
	 * 
	 * NOW WORKS PROPERLY! ✅
	 * 
	 * Creates a payment linked to an invitation.
	 * User MUST have a PENDING invitation to pay.
	 */
	async createPayment(user: RequestUser, dto: CreatePaymentDto) {
		this.logger.log(`Creating payment for user ${user.sub} for event ${dto.eventId}`);

		// 1. Get event and validate
		const event = await this.eventsService.findOne(dto.eventId);
		
		if (event.inviterId === user.sub) {
			throw new BadRequestException('Event creators cannot pay for their own events');
		}

		// 2. ✅ NEW: Check if user has PENDING invitation
		const invitation = await this.invitationsService.findPendingInvitation(
			dto.eventId,
			user.sub,
		);

		if (!invitation) {
			throw new ForbiddenException(
				'You must join the event first before making a payment. Use POST /invitations/join/:inviteToken',
			);
		}

		// 3. Calculate amounts
		const entryPrice = Number(event.entryPrice);
		const appFee = Number(((entryPrice * this.appFeePercent) / 100).toFixed(2));
		const total = entryPrice + appFee;
		const providerReference = randomUUID();
		const provider = this.paymentProviderFactory.getProvider();

		// 4. ✅ FIXED: Create payment WITH invitationId
		const payment = await this.prisma.payment.create({
			data: {
				eventId: event.id,
				userId: user.sub,
				invitationId: invitation.id, // ✅ Now properly linked!
				amount: new Prisma.Decimal(entryPrice),
				appFee: new Prisma.Decimal(appFee),
				providerReference,
				provider: provider.getProviderName(),
				providerPaymentUrl: null,
				status: PaymentStatus.PENDING,
			},
		});

		this.logger.log(`Payment ${payment.id} created, linked to invitation ${invitation.id}`);

		// 5. Create payment session via provider
		const session = await provider.createSession({
			reference: providerReference,
			amount: total,
			customerEmail: user.email,
			title: `Event: ${event.title}`,
		});

		// 6. Update payment with URL
		await this.prisma.payment.update({
			where: { id: payment.id },
			data: { providerPaymentUrl: session.paymentUrl },
		});

		return {
			paymentId: payment.id,
			paymentUrl: session.paymentUrl,
			providerReference,
			amount: entryPrice,
			appFee,
			total,
		};
	}

	async getStatus(paymentId: string) {
		const payment = await this.prisma.payment.findUnique({
			where: { id: paymentId },
		});
		
		if (!payment) {
			throw new NotFoundException('Payment not found');
		}

		return payment;
	}

	/**
	 * 🪝 PROCESS WEBHOOK
	 * 
	 * TODO Phase 3: Update invitation status and create ticket on SUCCESS
	 */
	async processWebhook(signature: string | undefined, payload: KonnectWebhookDto) {
		if (signature !== this.webhookSecret) {
			throw new ForbiddenException('Invalid webhook signature');
		}

		const payment = await this.prisma.payment.findUnique({
			where: { providerReference: payload.reference },
		});

		if (!payment) {
			this.logger.warn(`Webhook received for unknown reference ${payload.reference}`);
			return { success: false };
		}

		if (payment.status === payload.status) {
			return { success: true };
		}

		// TODO Phase 3: Update invitation status and create ticket
		await this.prisma.payment.update({
			where: { id: payment.id },
			data: { status: payload.status },
		});

		this.logger.log(`Payment ${payment.id} status updated to ${payload.status}`);

		return { success: true };
	}
}
