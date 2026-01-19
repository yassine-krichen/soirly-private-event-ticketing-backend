import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { EventsModule } from '../events/events.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { KonnectPaymentProvider } from './providers/konnect-payment.provider';
import { TestPaymentProvider } from './providers/test-payment.provider';
import { PaymentProviderFactory } from './providers/payment-provider.factory';

@Module({
  imports: [CommonModule, EventsModule],
  providers: [
    PaymentsService,
    KonnectPaymentProvider,
    TestPaymentProvider,
    PaymentProviderFactory,
  ],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
