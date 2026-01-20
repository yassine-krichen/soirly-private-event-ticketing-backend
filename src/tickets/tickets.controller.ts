import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  Logger,
  Post,
  Body,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TicketsService } from './tickets.service';
import { CheckinDto } from './dto/checkin.dto';

/**
 * 🎫 TICKETS CONTROLLER
 *
 * Handles ticket viewing and check-in operations.
 */
@Controller('tickets')
export class TicketsController {
  private readonly logger = new Logger(TicketsController.name);

  constructor(private readonly ticketsService: TicketsService) {}

  /**
   * 🎫 ENDPOINT: GET /tickets/me
   *
   * Get all tickets for authenticated user.
   *
   * Auth: Required (JWT)
   *
   * Query Params:
   * - status: 'upcoming' | 'past' | 'all' (default 'upcoming')
   * - page: number (default 1)
   * - pageSize: number (default 10, max 100)
   *
   * Response:
   * {
   *   "tickets": [
   *     {
   *       "id": "ticket-uuid",
   *       "ticketCode": "abc-123-def",
   *       "event": {
   *         "id": "event-uuid",
   *         "title": "Tech Meetup",
   *         "dateTime": "2026-02-15T20:00:00Z",
   *         "location": "Tunis",
   *         "entryPrice": 25.50
   *       },
   *       "checkedIn": false,
   *       "checkedInAt": null,
   *       "createdAt": "2026-01-20T10:00:00Z"
   *     }
   *   ],
   *   "pagination": {
   *     "total": 3,
   *     "page": 1,
   *     "pageSize": 10,
   *     "totalPages": 1
   *   }
   * }
   *
   * Use Case:
   * - User views their upcoming events
   * - Access tickets for event entrance (show QR code)
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyTickets(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 10;

    this.logger.log(
      `GET /tickets/me - User: ${req.user.sub}, Status: ${status || 'upcoming'}, Page: ${pageNum}`,
    );

    return this.ticketsService.getMyTickets(
      req.user.sub,
      status || 'upcoming',
      pageNum,
      Math.min(pageSizeNum, 100),
    );
  }

  /**
   * 🔍 ENDPOINT: GET /tickets/code/:ticketCode
   *
   * Get ticket details by ticket code.
   *
   * Auth: Required (JWT)
   *
   * Authorization:
   * - Ticket owner can view
   * - Event creator can view (for verification)
   *
   * URL Params:
   * - ticketCode: Unique ticket identifier (UUID)
   *
   * Response:
   * {
   *   "id": "ticket-uuid",
   *   "ticketCode": "abc-123-def",
   *   "event": {
   *     "id": "event-uuid",
   *     "title": "Tech Meetup",
   *     "dateTime": "2026-02-15T20:00:00Z",
   *     "location": "Tunis Convention Center",
   *     "entryPrice": 25.50
   *   },
   *   "checkedIn": false,
   *   "checkedInAt": null,
   *   "isValid": true,
   *   "holder": {  // Only visible to event creator
   *     "name": "John Doe",
   *     "email": "john@example.com"
   *   }
   * }
   *
   * Use Case:
   * - User views their ticket details
   * - Event staff scans QR code to verify ticket before check-in
   *
   * Errors:
   * - 404: Ticket not found
   * - 403: Not authorized (not ticket owner or event creator)
   */
  @Get('code/:ticketCode')
  @UseGuards(JwtAuthGuard)
  async getTicketByCode(
    @Param('ticketCode') ticketCode: string,
    @Req() req: any,
  ) {
    this.logger.log(`GET /tickets/code/${ticketCode} - User: ${req.user.sub}`);
    return this.ticketsService.getTicketByCode(ticketCode, req.user.sub);
  }

  /**
   * 🔍 ENDPOINT: GET /tickets/:id
   *
   * Get ticket details by ticket ID.
   *
   * Auth: Required (JWT)
   *
   * Same authorization and response as GET /tickets/code/:ticketCode
   * Alternative way to fetch ticket (by database ID instead of code).
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getTicketById(@Param('id') ticketId: string, @Req() req: any) {
    this.logger.log(`GET /tickets/${ticketId} - User: ${req.user.sub}`);
    return this.ticketsService.getTicketById(ticketId, req.user.sub);
  }
}
