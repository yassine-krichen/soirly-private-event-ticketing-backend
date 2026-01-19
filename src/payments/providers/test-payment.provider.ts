import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentProvider,
  CreateSessionArgs,
  PaymentSession,
} from './payment-provider.interface';

/**
 * TestPaymentProvider - Fake Payment Gateway for Development
 * 
 * PURPOSE:
 * Simulates payment flow WITHOUT calling real payment gateway.
 * No real money involved, no API keys needed, instant testing.
 * 
 * WHY USE THIS:
 * - Develop features without worrying about real charges
 * - Test payment success/failure scenarios easily
 * - No need for Konnect API credentials in development
 * - Faster development (no network calls to external API)
 * 
 * HOW IT WORKS:
 * 1. User clicks "Pay" button in your app
 * 2. Backend creates payment record in database (status=PENDING)
 * 3. THIS provider returns a fake payment URL
 * 4. In real app: user would be redirected to this URL
 * 5. You manually trigger a webhook to mark payment as SUCCESS/FAILED
 * 
 * TESTING FLOW:
 * 1. Create event
 * 2. Try to pay (creates payment, gets fake URL)
 * 3. Manually call webhook endpoint with SUCCESS status
 * 4. Payment marked as successful, ticket generated
 * 
 * TO ENABLE:
 * Set in .env file: TEST_PAYMENT_MODE=true
 */
@Injectable()
export class TestPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(TestPaymentProvider.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    // Your backend URL (where webhooks will be sent)
    this.baseUrl = this.configService.get<string>(
      'APP_BASE_URL',
      'http://localhost:3000',
    );
  }

  /**
   * Returns "test" to identify this provider in database
   */
  getProviderName(): string {
    return 'test';
  }

  /**
   * Creates a FAKE payment session
   * 
   * In real provider (Konnect):
   * - Makes API call to Konnect
   * - Gets real payment URL from Konnect
   * - User redirected to Konnect checkout page
   * 
   * In test provider:
   * - Just generates a fake URL
   * - Logs payment details
   * - Returns immediately (no API call)
   * 
   * PARAMETERS:
   * @param args.reference - Unique payment ID (UUID)
   * @param args.amount - Total amount to charge (entry price + app fee)
   * @param args.customerEmail - Who is paying
   * @param args.title - What they're paying for
   * 
   * RETURNS:
   * Fake payment URL that could be used for testing
   */
  async createSession(args: CreateSessionArgs): Promise<PaymentSession> {
    // Log payment details for debugging
    this.logger.log('[TEST MODE] Creating fake payment session');
    this.logger.log(`   Customer: ${args.customerEmail}`);
    this.logger.log(`   Amount: $${args.amount}`);
    this.logger.log(`   Reference: ${args.reference}`);
    this.logger.log(`   For: ${args.title}`);

    // Generate a fake payment URL
    // In a real app, you'd build a test payment page at this URL
    // where you can click "Success" or "Fail" buttons
    const paymentUrl = `${this.baseUrl}/test-payment/${args.reference}?amount=${args.amount}`;

    this.logger.log(`   Payment URL: ${paymentUrl}`);
    this.logger.log('   TIP: Manually trigger webhook to complete payment');

    return {
      paymentUrl,
      reference: args.reference,
    };
  }
}
