import {
  Controller,
  Post,
  Param,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { InvitationsService } from './invitations.service';

/**
 * 📨 INVITATIONS CONTROLLER
 * 
 * Handles user actions on invitations (join, decline).
 * These are the endpoints users interact with after clicking invite links.
 */
@Controller('invitations')
export class InvitationsController {
  private readonly logger = new Logger(InvitationsController.name);

  constructor(private readonly invitationsService: InvitationsService) {}

  /**
   * 🎯 ENDPOINT: POST /invitations/join/:inviteToken
   * 
   * User joins an event via invite link (creates PENDING invitation).
   * 
   * Auth: Required (JWT)
   * 
   * FLOW:
   * 1. User clicks invite link → frontend shows event details
   * 2. User authenticates (signup/signin)
   * 3. User clicks "Join Event" → calls this endpoint
   * 4. Creates EventInvitation with status = PENDING
   * 5. User proceeds to payment
   * 
   * URL Params:
   * - inviteToken: The unique token from the invite link
   * 
   * Response:
   * {
   *   "invitation": {
   *     "id": "invitation-uuid",
   *     "status": "PENDING",
   *     "event": {
   *       "id": "event-uuid",
   *       "title": "Party Night",
   *       "entryPrice": 25.50,
   *       ...
   *     }
   *   },
   *   "message": "Successfully joined! Please complete payment to confirm.",
   *   "nextStep": "PAYMENT"
   * }
   * 
   * Errors:
   * - 404: Invalid invite token
   * - 403: Invite link inactive OR user is event creator
   * - 410: Event has already occurred
   * - 409: Event at full capacity OR already attending
   * 
   * IDEMPOTENCY:
   * Safe to call multiple times - returns existing invitation if already joined.
   */
  @Post('join/:inviteToken')
  @UseGuards(JwtAuthGuard)
  async joinEvent(@Param('inviteToken') inviteToken: string, @Req() req: any) {
    this.logger.log(
      `POST /invitations/join/${inviteToken} - User: ${req.user.sub}`,
    );
    return this.invitationsService.joinEventViaInvite(
      inviteToken,
      req.user.sub,
    );
  }

  /**
   * ❌ ENDPOINT: POST /invitations/:id/decline
   * 
   * User declines an invitation (sets status to DECLINED).
   * 
   * Auth: Required (JWT)
   * 
   * WHY DECLINE?
   * - User changed their mind
   * - Can't attend anymore
   * - Want to remove from their events list
   * 
   * URL Params:
   * - id: Invitation UUID
   * 
   * Response:
   * {
   *   "invitation": {
   *     "id": "invitation-uuid",
   *     "status": "DECLINED",
   *     "declinedAt": "2026-01-20T12:00:00Z"
   *   },
   *   "message": "Invitation declined. You can re-join anytime."
   * }
   * 
   * Errors:
   * - 404: Invitation not found
   * - 403: Not your invitation
   * - 409: Already confirmed (can't decline confirmed attendance)
   * 
   * NOTE:
   * User can re-join later by calling /invitations/join/:inviteToken again.
   */
  @Post(':id/decline')
  @UseGuards(JwtAuthGuard)
  async declineInvitation(@Param('id') id: string, @Req() req: any) {
    this.logger.log(`POST /invitations/${id}/decline - User: ${req.user.sub}`);
    return this.invitationsService.declineInvitation(id, req.user.sub);
  }
}
