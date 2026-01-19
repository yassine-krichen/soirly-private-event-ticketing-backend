import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  PaymentProvider,
  CreateSessionArgs,
  PaymentSession,
} from './payment-provider.interface';

@Injectable()
export class KonnectPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(KonnectPaymentProvider.name);
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'KONNECT_BASE_URL',
      'https://sandbox.konnect.network',
    );
    this.apiKey = this.configService.get<string>('KONNECT_API_KEY');
  }

  getProviderName(): string {
    return 'konnect';
  }

  async createSession(args: CreateSessionArgs): Promise<PaymentSession> {
    if (!this.apiKey) {
      this.logger.warn('KONNECT_API_KEY missing; returning mocked payment URL');
      return {
        paymentUrl: `${this.baseUrl}/mock/pay/${args.reference}`,
        reference: args.reference,
      };
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/payments`,
        {
          amount: args.amount,
          reference: args.reference,
          customer: { email: args.customerEmail },
          description: args.title,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
      );

      return {
        paymentUrl:
          response.data?.paymentUrl ??
          `${this.baseUrl}/mock/pay/${args.reference}`,
        reference: args.reference,
      };
    } catch (error) {
      this.logger.error('Konnect session creation failed', error as Error);
      throw error;
    }
  }
}
