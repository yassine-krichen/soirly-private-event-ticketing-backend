import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { EventsModule } from '../events/events.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { KonnectService } from './konnect.service';

@Module({
  imports: [CommonModule, EventsModule],
  providers: [PaymentsService, KonnectService],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
