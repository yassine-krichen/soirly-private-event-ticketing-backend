import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * PaymentAccessGuard - Security Guard for Payment Details
 * 
 * PURPOSE:
 * Protects payment information from unauthorized access.
 * Payment details contain sensitive info (amounts, status, etc.)
 * so we need to restrict who can view them.
 * 
 * WHO CAN ACCESS A PAYMENT:
 * 1. The person who created the payment (the one paying)
 * 2. The event organizer (to track who paid for their event)
 * 3. Admins (for support/dispute resolution)
 * 
 * EXAMPLE SCENARIOS:
 * - Alice creates event
 * - Bob clicks invite link and pays
 * - Bob can view HIS payment status
 * - Alice (event owner) can view Bob's payment to confirm attendance
 * - Charlie (random user) CANNOT view Bob's payment
 * 
 * FLOW:
 * - User sends request to GET /payments/:id/status
 * - JwtAuthGuard validates JWT token first
 * - Then THIS guard checks if user can access THIS specific payment
 * - If authorized: payment details returned
 * - If not: 403 Forbidden
 * 
 * USAGE:
 * @UseGuards(JwtAuthGuard, PaymentAccessGuard)
 */
@Injectable()
export class PaymentAccessGuard implements CanActivate {
  private readonly logger = new Logger(PaymentAccessGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * This runs BEFORE the controller endpoint
   * Returns true = allow access
   * Throws exception = deny access
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get the HTTP request object
    const request = context.switchToHttp().getRequest();
    
    // user from JWT: { sub: userId, email, role }
    const user = request.user;
    
    // paymentId from URL: /payments/abc-123-def/status
    const paymentId = request.params.id;

    // Sanity check
    if (!user || !paymentId) {
      this.logger.warn('Missing user or paymentId in request');
      return false;
    }

    // RULE 1: Admins can access all payments (for support)
    if (user.role === Role.ADMIN) {
      this.logger.log(`Admin ${user.sub} accessing payment ${paymentId}`);
      return true;
    }

    // RULE 2 & 3: Check if user is payment creator OR event owner
    // Query database to get payment info
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        userId: true, // Who made this payment?
        event: {
          select: { inviterId: true }, // Who created the event?
        },
      },
    });

    // Payment doesn't exist
    if (!payment) {
      throw new ForbiddenException('Payment not found');
    }

    // Check if user is the one who made the payment
    const isPaymentCreator = payment.userId === user.sub;
    
    // Check if user is the event organizer
    const isEventCreator = payment.event.inviterId === user.sub;

    // If neither the payer nor event owner, DENY
    if (!isPaymentCreator && !isEventCreator) {
      this.logger.warn(
        `User ${user.sub} attempted to access payment ${paymentId} without permission`,
      );
      throw new ForbiddenException(
        'You do not have permission to access this payment',
      );
    }

    // User passed checks, ALLOW access
    this.logger.log(`User ${user.sub} authorized to access payment ${paymentId}`);
    return true;
  }
}
