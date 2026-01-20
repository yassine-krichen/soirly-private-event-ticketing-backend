import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EventAccessGuard } from '../common/guards/event-access.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { ToggleInviteLinkDto } from './dto/toggle-invite-link.dto';
import { EventsService } from './events.service';

/**
 * 🎉 EVENTS CONTROLLER
 *
 * Handles event creation, retrieval, and invitation management.
 */
@Controller('events')
export class EventsController {
  private readonly logger = new Logger(EventsController.name);

  constructor(private readonly eventsService: EventsService) {}

  /**
   * 📝 ENDPOINT: POST /events
   *
   * Create a new event.
   *
   * Auth: Required (JWT)
   *
   * Request Body:
   * {
   *   "title": "My Party",
   *   "description": "Come party with us!",
   *   "dateTime": "2026-02-15T20:00:00Z",
   *   "location": "123 Main St",
   *   "entryPrice": 25.50
   * }
   *
   * Response:
   * {
   *   "id": "event-uuid",
   *   "title": "My Party",
   *   "inviteToken": "unique-token-uuid",  // ⭐ Use this for invite link!
   *   "inviteLinkActive": true,            // Can toggle this on/off
   *   "maxAttendees": null,                // null = unlimited
   *   "inviterId": "your-user-id",
   *   "isPrivate": true,
   *   ...
   * }
   *
   * The inviteToken is what people will use to join:
   * Invite URL: http://yourapp.com/events/invite/{inviteToken}
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: any, @Body() dto: CreateEventDto) {
    // req.user.sub = authenticated user's ID
    return this.eventsService.create(req.user.sub, dto);
  }

  /**
   * 📋 ENDPOINT: GET /events/me
   *
   * Get all events created by the authenticated user.
   *
   * Auth: Required (JWT)
   *
   * Response:
   * [
   *   {
   *     "id": "event-uuid-1",
   *     "title": "My First Event",
   *     "dateTime": "2026-03-01T18:00:00Z",
   *     "entryPrice": 25.00,
   *     "inviteToken": "...",
   *     "inviteLinkActive": true,
   *     ...
   *   },
   *   {
   *     "id": "event-uuid-2",
   *     "title": "My Second Event",
   *     ...
   *   }
   * ]
   *
   * Use Case:
   * - Dashboard showing all your created events
   * - Event management page
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  listMyEvents(@Req() req: any) {
    this.logger.log(`GET /events/me - User: ${req.user.sub}`);
    return this.eventsService.listForInviter(req.user.sub);
  }

  /**
   * 🌐 ENDPOINT: GET /events/invite/:inviteToken
   *
   * PUBLIC endpoint to view event via invite link.
   *
   * Auth: NONE (anyone can view if they have the token)
   *
   * FLOW:
   * 1. User receives invite link from friend
   * 2. Clicks link → calls this endpoint
   * 3. Sees event details WITHOUT authentication
   * 4. If interested → must authenticate → then join
   *
   * URL Params:
   * - inviteToken: The unique token from event.inviteToken
   *
   * Response:
   * {
   *   "event": {
   *     "id": "event-uuid",
   *     "title": "Party Night",
   *     "description": "...",
   *     "dateTime": "2026-02-15T20:00:00Z",
   *     "location": "123 Main St",
   *     "entryPrice": 25.50,
   *     "maxAttendees": 50,
   *     "spotsAvailable": 25,
   *     "confirmedAttendees": 25
   *   },
   *   "requiresAuth": true,
   *   "inviteLinkActive": true
   * }
   *
   * Security:
   * - Does NOT reveal inviter email or sensitive info
   * - Only shows public event details
   *
   * Errors:
   * - 404: Invalid token
   * - 403: Invite link inactive
   */
  @Get('invite/:inviteToken')
  async viewEventByInvite(@Param('inviteToken') inviteToken: string) {
    this.logger.log(`GET /events/invite/${inviteToken} - Public access`);
    return this.eventsService.getEventByInviteToken(inviteToken);
  }

  /**
   * 👁️ ENDPOINT: GET /events/:id
   *
   * Get event details by ID.
   *
   * Auth: Required (JWT) + EventAccessGuard
   *
   * Access Control:
   * - Event creator can always access
   * - Users with invitation can access
   * - Admins can access
   * - Everyone else: 403 Forbidden
   *
   * Response: Event object with all details
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, EventAccessGuard)
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  /**
   * 🔗 ENDPOINT: GET /events/:id/invite-link
   *
   * Get invite link info and stats (event owner only).
   *
   * Auth: Required (JWT) + Must be event owner
   *
   * Response:
   * {
   *   "inviteLink": "https://app.soirly.example/events/invite/{token}",
   *   "inviteToken": "unique-token-uuid",
   *   "isActive": true,
   *   "stats": {
   *     "pendingInvitations": 5,
   *     "confirmedAttendees": 12,
   *     "declinedInvitations": 2
   *   }
   * }
   *
   * Use Case:
   * - Event creator wants to share the link
   * - Check how many people have joined
   */
  @Get(':id/invite-link')
  @UseGuards(JwtAuthGuard)
  async getInviteLink(@Param('id') eventId: string, @Req() req: any) {
    this.logger.log(
      `GET /events/${eventId}/invite-link - User: ${req.user.sub}`,
    );
    return this.eventsService.getInviteLinkInfo(eventId, req.user.sub);
  }

  /**
   * 🔄 ENDPOINT: PATCH /events/:id/invite-link/toggle
   *
   * Toggle invite link on/off (event owner only).
   *
   * Auth: Required (JWT) + Must be event owner
   *
   * Request Body:
   * {
   *   "active": false  // true to enable, false to disable
   * }
   *
   * Use Case:
   * - Stop accepting new attendees
   * - Temporarily disable link
   *
   * Response:
   * {
   *   "inviteLinkActive": false,
   *   "message": "Invite link has been disabled"
   * }
   */
  @Patch(':id/invite-link/toggle')
  @UseGuards(JwtAuthGuard)
  async toggleInviteLink(
    @Param('id') eventId: string,
    @Body() dto: ToggleInviteLinkDto,
    @Req() req: any,
  ) {
    this.logger.log(
      `PATCH /events/${eventId}/invite-link/toggle - User: ${req.user.sub}, Active: ${dto.active}`,
    );
    return this.eventsService.toggleInviteLink(
      eventId,
      req.user.sub,
      dto.active,
    );
  }

  /**
   * 🔁 ENDPOINT: POST /events/:id/invite-link/regenerate
   *
   * Regenerate invite token (event owner only).
   *
   * Auth: Required (JWT) + Must be event owner
   *
   * Use Case:
   * - Old link was shared publicly by mistake
   * - Want to invalidate all existing links
   * - Security: someone unauthorized has the link
   *
   * ⚠️ WARNING:
   * This creates a NEW token and makes the OLD one invalid!
   * Anyone with the old link won't be able to join anymore.
   *
   * Response:
   * {
   *   "inviteToken": "new-unique-token-uuid",
   *   "inviteLink": "https://app.soirly.example/events/invite/{new-token}",
   *   "message": "Invite link has been regenerated. Old link is now invalid."
   * }
   */
  @Post(':id/invite-link/regenerate')
  @UseGuards(JwtAuthGuard)
  async regenerateInviteLink(@Param('id') eventId: string, @Req() req: any) {
    this.logger.log(
      `POST /events/${eventId}/invite-link/regenerate - User: ${req.user.sub}`,
    );
    return this.eventsService.regenerateInviteToken(eventId, req.user.sub);
  }
}
