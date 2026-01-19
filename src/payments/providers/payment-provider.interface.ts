export interface CreateSessionArgs {
  reference: string;
  amount: number;
  customerEmail: string;
  title: string;
}

export interface PaymentSession {
  paymentUrl: string;
  reference: string;
}

/**
 * Payment provider interface
 * Implementations: KonnectPaymentProvider, TestPaymentProvider, StripePaymentProvider, etc.
 */
export interface PaymentProvider {
  /**
   * Create a payment session and return the payment URL
   */
  createSession(args: CreateSessionArgs): Promise<PaymentSession>;

  /**
   * Get provider name
   */
  getProviderName(): string;
}
