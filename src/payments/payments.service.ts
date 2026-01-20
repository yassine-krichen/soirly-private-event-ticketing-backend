import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
    this.webhookSecret = configService.get<string>(
      'KONNECT_WEBHOOK_SECRET',
      'konnect-webhook-secret',
    );
    this.appFeePercent = Number(
      configService.get<string>('APP_FEE_PERCENT', '5'),
    );
  }

  /**
   * 💰 CREATE PAYMENT
   *
   * Creates a payment linked to an invitation.
   * User MUST have a PENDING invitation to pay.
   *
   * RETRY LOGIC:
   * If user has existing PENDING payments, marks them as FAILED (audit trail).
   */
  async createPayment(user: RequestUser, dto: CreatePaymentDto) {
    this.logger.log(
      `Creating payment for user ${user.sub} for event ${dto.eventId}`,
    );

    // 1. Get event and validate
    const event = await this.eventsService.findOne(dto.eventId);

    if (event.inviterId === user.sub) {
      throw new BadRequestException(
        'Event creators cannot pay for their own events',
      );
    }

    // 2. Check if user has PENDING invitation
    const invitation = await this.invitationsService.findPendingInvitation(
      dto.eventId,
      user.sub,
    );

    if (!invitation) {
      throw new ForbiddenException(
        'You must join the event first before making a payment. Use POST /invitations/join/:inviteToken',
      );
    }

    // 3. RETRY LOGIC: Cancel any existing PENDING payments for this invitation
    const existingPendingPayments = await this.prisma.payment.findMany({
      where: {
        userId: user.sub,
        eventId: dto.eventId,
        invitationId: invitation.id,
        status: PaymentStatus.PENDING,
      },
    });

    if (existingPendingPayments.length > 0) {
      this.logger.log(
        `Found ${existingPendingPayments.length} existing PENDING payment(s) for user ${user.sub}, marking as FAILED`,
      );

      await this.prisma.payment.updateMany({
        where: {
          id: { in: existingPendingPayments.map((p) => p.id) },
        },
        data: { status: PaymentStatus.FAILED },
      });
    }

    // 4. Calculate amounts
    const entryPrice = Number(event.entryPrice);
    const appFee = Number(((entryPrice * this.appFeePercent) / 100).toFixed(2));
    const total = entryPrice + appFee;
    const providerReference = randomUUID();
    const provider = this.paymentProviderFactory.getProvider();

    // 5. Create new payment
    const payment = await this.prisma.payment.create({
      data: {
        eventId: event.id,
        userId: user.sub,
        invitationId: invitation.id,
        amount: new Prisma.Decimal(entryPrice),
        appFee: new Prisma.Decimal(appFee),
        providerReference,
        provider: provider.getProviderName(),
        providerPaymentUrl: null,
        status: PaymentStatus.PENDING,
      },
    });

    this.logger.log(
      `Payment ${payment.id} created, linked to invitation ${invitation.id}`,
    );

    // 6. Create payment session via provider
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
   * Handles payment status updates from payment provider.
   *
   * ON SUCCESS:
   * 1. Updates payment status
   * 2. Updates invitation to CONFIRMED
   * 3. Creates ticket
   *
   * ON FAILURE:
   * 4. Updates payment status only
   * 5. Keeps invitation as PENDING (user can retry)
   */
  async processWebhook(
    signature: string | undefined,
    payload: KonnectWebhookDto,
  ) {
    if (signature !== this.webhookSecret) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { providerReference: payload.reference },
      include: {
        invitation: true,
        event: true,
      },
    });

    if (!payment) {
      this.logger.warn(
        `Webhook received for unknown reference ${payload.reference}`,
      );
      return { success: false };
    }

    // Idempotency: If status already matches, do nothing
    if (payment.status === payload.status) {
      this.logger.log(
        `Payment ${payment.id} already has status ${payload.status} (idempotent)`,
      );
      return { success: true };
    }

    // Handle SUCCESS: Update payment, confirm invitation, create ticket
    if (payload.status === PaymentStatus.SUCCESS) {
      this.logger.log(
        `Payment ${payment.id} succeeded - creating ticket and confirming invitation`,
      );

      try {
        // Use transaction to ensure atomicity
        await this.prisma.$transaction(async (tx) => {
          // 1. Update payment status
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.SUCCESS },
          });

          // 2. Update invitation to CONFIRMED
          await tx.eventInvitation.update({
            where: { id: payment.invitationId },
            data: {
              status: 'CONFIRMED',
              confirmedAt: new Date(),
            },
          });

          // 3. Create ticket (idempotent: unique constraint on eventId_userId)
          await tx.ticket.upsert({
            where: {
              eventId_userId: {
                eventId: payment.eventId,
                userId: payment.userId,
              },
            },
            create: {
              eventId: payment.eventId,
              userId: payment.userId,
              paymentId: payment.id,
            },
            update: {
              // If ticket exists, update paymentId (shouldn't happen normally)
              paymentId: payment.id,
            },
          });
        });

        this.logger.log(
          `✅ Payment ${payment.id} processed: invitation confirmed, ticket created`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to process successful payment ${payment.id}:`,
          error,
        );
        throw error;
      }
    }
    // Handle FAILED or PENDING: Just update payment status
    else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: payload.status },
      });

      this.logger.log(
        `Payment ${payment.id} status updated to ${payload.status} (invitation remains PENDING)`,
      );
    }

    return { success: true };
  }
}
