import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { EventsModule } from '../events/events.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { InvitationsScheduler } from './invitations.scheduler';

/**
 * 📨 INVITATIONS MODULE
 *
 * Handles the invitation system - the core feature of Soirly.
 *
 * FLOW:
 * 1. Event creator generates invite link
 * 2. Friend clicks link → sees event details
 * 3. Friend authenticates → clicks "Join Event"
 * 4. Creates EventInvitation (status: PENDING)
 * 5. Friend proceeds to payment
 * 6. Payment success → invitation becomes CONFIRMED
 *
 * BACKGROUND JOBS:
 * - InvitationsScheduler: Auto-expires PENDING invitations > 24h
 */
@Module({
  imports: [CommonModule, EventsModule],
  providers: [InvitationsService, InvitationsScheduler],
  controllers: [InvitationsController],
  exports: [InvitationsService],
})
export class InvitationsModule {}
