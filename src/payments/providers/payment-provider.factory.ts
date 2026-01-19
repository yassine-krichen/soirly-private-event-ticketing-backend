import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider } from './payment-provider.interface';
import { KonnectPaymentProvider } from './konnect-payment.provider';
import { TestPaymentProvider } from './test-payment.provider';

/**
 * PaymentProviderFactory - Chooses which payment provider to use
 * 
 * PURPOSE:
 * We support multiple payment gateways (Konnect, Test mode, future: Stripe).
 * This factory decides which one to use based on environment configuration.
 * 
 * WHY DO WE NEED THIS:
 * - In DEVELOPMENT: Use TestPaymentProvider (fake payments, no real money)
 * - In PRODUCTION: Use KonnectPaymentProvider (real Tunisian payment gateway)
 * - In FUTURE: Could add StripeProvider for international payments
 * 
 * HOW IT WORKS:
 * 1. Check .env file for TEST_PAYMENT_MODE
 * 2. If TEST_PAYMENT_MODE=true → Use TestPaymentProvider
 * 3. If TEST_PAYMENT_MODE=false → Use KonnectPaymentProvider
 * 
 * BENEFITS:
 * - Test payment flow without spending real money
 * - Easily switch between providers
 * - Add new payment providers without changing PaymentsService code
 * 
 * USAGE IN CODE:
 * const provider = this.paymentProviderFactory.getProvider();
 * const session = await provider.createSession({...});
 */
@Injectable()
export class PaymentProviderFactory {
  private readonly logger = new Logger(PaymentProviderFactory.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly konnectProvider: KonnectPaymentProvider,
    private readonly testProvider: TestPaymentProvider,
  ) {}

  /**
   * Returns the appropriate payment provider based on configuration
   * 
   * LOGIC:
   * - Read TEST_PAYMENT_MODE from .env
   * - If "true" → return test provider (fake payments)
   * - If "false" → return Konnect provider (real payments)
   */
  getProvider(): PaymentProvider {
    const testMode = this.configService.get<string>('TEST_PAYMENT_MODE', 'false');
    
    if (testMode === 'true') {
      this.logger.log('Using TEST payment provider (no real charges)');
      return this.testProvider;
    }

    this.logger.log('Using KONNECT payment provider (real charges)');
    return this.konnectProvider;
  }

  /**
   * Returns the name of the current provider ("konnect" or "test")
   * Used for logging and storing in database
   */
  getProviderName(): string {
    return this.getProvider().getProviderName();
  }
}
