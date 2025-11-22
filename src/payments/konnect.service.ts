import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface CreateSessionArgs {
  reference: string;
  amount: number;
  customerEmail: string;
  title: string;
}

@Injectable()
export class KonnectService {
  private readonly logger = new Logger(KonnectService.name);
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('KONNECT_BASE_URL', 'https://sandbox.konnect.network');
    this.apiKey = this.configService.get<string>('KONNECT_API_KEY');
  }

  async createSession(args: CreateSessionArgs) {
    if (!this.apiKey) {
      // Fall back to a mocked URL to keep local development unblocked.
      this.logger.warn('KONNECT_API_KEY missing; returning mocked payment session URL');
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
        paymentUrl: response.data?.paymentUrl ?? `${this.baseUrl}/mock/pay/${args.reference}`,
        reference: args.reference,
      };
    } catch (error) {
      this.logger.error('Konnect session creation failed', error as Error);
      throw error;
    }
  }
}
