import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PaymentAccessGuard } from '../common/guards/payment-access.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { KonnectWebhookDto } from './dto/konnect-webhook.dto';
import { PaymentsService } from './payments.service';

/**
 * 💳 PAYMENTS CONTROLLER
 *
 * Handles payment creation, status checks, and webhook processing.
 *
 * CURRENT STATE (BROKEN):
 * - ⚠️ POST /payments will FAIL (no invitation system yet)
 * - ⚠️ GET /payments/:id/status has NO authorization check
 *
 * TODO (Phase 3):
 * - Link payments to invitations
 * - Add PaymentAccessGuard to status endpoint
 * - Generate tickets on successful payment
 */
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * 💰 ENDPOINT: POST /payments
   *
   * Initiate a payment for an event.
   *
   * Auth: Required (JWT)
   *
   * Request Body:
   * {
   *   "eventId": "event-uuid"
   * }
   *
   * ⚠️ CURRENTLY BROKEN:
   * This will fail with "Required relation violation (invitationId)"
   * because we haven't implemented the invitation system yet.
   *
   * EXPECTED FLOW (Phase 3):
   * 1. User clicks invite link → creates EventInvitation (status: PENDING)
   * 2. User calls this endpoint → creates Payment linked to invitation
   * 3. User pays via payment URL
   * 4. Webhook updates payment status → invitation becomes CONFIRMED → ticket generated
   *
   * Response (when fixed):
   * {
   *   "paymentId": "payment-uuid",
   *   "paymentUrl": "http://localhost:3000/test-payment/...",  // Test mode URL
   *   "amount": 25.50,
   *   "appFee": 1.28,
   *   "total": 26.78
   * }
   *
   * Errors:
   * - 403: User is event creator (can't pay for own event)
   * - 404: Event not found
   * - 409: Event at capacity
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: any, @Body() dto: CreatePaymentDto) {
    // req.user = { sub: userId, email: userEmail }
    return this.paymentsService.createPayment(req.user, dto);
  }

  /**
   * 📊 ENDPOINT: GET /payments/:id/status
   *
   * Check payment status.
   *
   * Auth: Required (JWT) + PaymentAccessGuard
   *
   * Access Control:
   * ✅ Payment creator (user who made the payment)
   * ✅ Event owner (user who created the event)
   * ✅ Admins
   * ❌ Everyone else: 403 Forbidden
   *
   * Response:
   * {
   *   "id": "payment-uuid",
   *   "status": "PENDING" | "SUCCESS" | "FAILED",
   *   "amount": 25.50,
   *   "appFee": 1.28,
   *   "providerPaymentUrl": "...",
   *   "createdAt": "...",
   *   ...
   * }
   */
  @Get(':id/status')
  @UseGuards(JwtAuthGuard, PaymentAccessGuard)
  status(@Param('id') id: string) {
    return this.paymentsService.getStatus(id);
  }

  /**
   * 🪝 ENDPOINT: POST /payments/webhook
   *
   * Webhook endpoint for payment provider (Konnect/Test) to notify us of payment status.
   *
   * Auth: None (public endpoint, verified by signature)
   *
   * HOW IT WORKS:
   * 1. User completes payment on Konnect/Test provider site
   * 2. Provider sends POST request to this endpoint
   * 3. We verify the signature (x-konnect-signature header)
   * 4. Update payment status in database
   * 5. If SUCCESS → update invitation → generate ticket
   *
   * Request Headers:
   * x-konnect-signature: <webhook-secret>
   *
   * Request Body:
   * {
   *   "reference": "provider-reference-uuid",  // The providerReference from payment
   *   "status": "SUCCESS" | "FAILED",
   *   "amount": 26.78
   * }
   *
   * Security:
   * - Must match KONNECT_WEBHOOK_SECRET from .env
   * - Prevents random people from faking successful payments
   *
   * Response:
   * { "success": true }
   */
  @Post('webhook')
  @SkipThrottle() // External API calls - do not throttle
  webhook(
    @Headers('x-konnect-signature') signature: string | undefined,
    @Body() dto: KonnectWebhookDto,
  ) {
    return this.paymentsService.processWebhook(signature, dto);
  }
}
