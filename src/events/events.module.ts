import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [CommonModule],
  providers: [EventsService],
  controllers: [EventsController],
  exports: [EventsService],
})
export class EventsModule {}
