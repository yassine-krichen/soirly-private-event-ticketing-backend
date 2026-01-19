import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { EventsService } from './events.service';

/**
 * 🎉 EVENTS CONTROLLER
 * 
 * Handles event creation and retrieval.
 * 
 * CURRENT STATE (OLD/BROKEN):
 * - ⚠️ GET /events/:id has NO authorization check
 * - ⚠️ Anyone with a JWT can view ANY event
 * 
 * TODO (Phase 2):
 * - Add EventAccessGuard to GET /events/:id
 * - Add invitation management endpoints
 * - Add public invite link endpoint
 */
@Controller('events')
export class EventsController {
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
	 * 👁️ ENDPOINT: GET /events/:id
	 * 
	 * Get event details by ID.
	 * 
	 * Auth: Required (JWT)
	 * 
	 * ⚠️ SECURITY ISSUE (CURRENT):
	 * Right now, ANY authenticated user can view ANY event!
	 * This defeats the purpose of private events.
	 * 
	 * TODO (Phase 2):
	 * Add @UseGuards(EventAccessGuard) to restrict access to:
	 * 1. Event creator
	 * 2. Users with an invitation to this event
	 * 3. Admins
	 * 
	 * Response: Event object with all details
	 */
	@Get(':id')
	@UseGuards(JwtAuthGuard)
	// TODO: Add EventAccessGuard here!
	findOne(@Param('id') id: string) {
		return this.eventsService.findOne(id);
	}
}
