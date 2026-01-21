import {
  Controller,
  Post,
  Param,
  Get,
  Query,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
  @Throttle({ medium: { limit: 20, ttl: 60000 } }) // 20 joins per minute
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

  /**
   * 📋 ENDPOINT: GET /invitations/me
   *
   * Get all invitations for authenticated user.
   *
   * Auth: Required (JWT)
   *
   * Query Params:
   * - status: 'all' | 'pending' | 'confirmed' | 'declined' (default 'all')
   * - page: number (default 1)
   * - pageSize: number (default 20, max 100)
   *
   * Response:
   * {
   *   "invitations": [
   *     {
   *       "id": "invitation-uuid",
   *       "status": "CONFIRMED",
   *       "event": {
   *         "id": "event-uuid",
   *         "title": "Tech Meetup",
   *         "dateTime": "2026-02-15T20:00:00Z",
   *         "location": "Tunis",
   *         "entryPrice": 25.50
   *       },
   *       "createdAt": "2026-01-15T10:00:00Z",
   *       "confirmedAt": "2026-01-15T10:05:00Z",
   *       "declinedAt": null
   *     }
   *   ],
   *   "pagination": {
   *     "total": 3,
   *     "page": 1,
   *     "pageSize": 20,
   *     "totalPages": 1
   *   }
   * }
   *
   * Use Case:
   * - User views events they're invited to
   * - Check invitation status before payment
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyInvitations(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;

    this.logger.log(
      `GET /invitations/me - User: ${req.user.sub}, Status: ${status || 'all'}, Page: ${pageNum}`,
    );

    return this.invitationsService.getMyInvitations(
      req.user.sub,
      status || 'all',
      pageNum,
      Math.min(pageSizeNum, 100),
    );
  }

  /**
   * 🔍 ENDPOINT: GET /invitations/:id
   *
   * Get detailed information about a specific invitation.
   *
   * Auth: Required (JWT)
   *
   * Authorization:
   * - Invitation owner can view
   * - Event creator can view (to check invitation status)
   *
   * URL Params:
   * - id: Invitation UUID
   *
   * Response:
   * {
   *   "id": "invitation-uuid",
   *   "status": "CONFIRMED",
   *   "event": {
   *     "id": "event-uuid",
   *     "title": "Tech Meetup",
   *     "dateTime": "2026-02-15T20:00:00Z",
   *     "location": "Tunis",
   *     "entryPrice": 25.50
   *   },
   *   "createdAt": "2026-01-15T10:00:00Z",
   *   "confirmedAt": "2026-01-15T10:05:00Z",
   *   "declinedAt": null,
   *   "user": {  // Only visible to event creator
   *     "name": "John Doe",
   *     "email": "john@example.com"
   *   }
   * }
   *
   * Use Case:
   * - User checks invitation details before payment
   * - Event creator verifies invitation status
   *
   * Errors:
   * - 404: Invitation not found
   * - 403: Not authorized (not invitation owner or event creator)
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getInvitationById(@Param('id') id: string, @Req() req: any) {
    this.logger.log(`GET /invitations/${id} - User: ${req.user.sub}`);
    return this.invitationsService.getInvitationById(id, req.user.sub);
  }
}
