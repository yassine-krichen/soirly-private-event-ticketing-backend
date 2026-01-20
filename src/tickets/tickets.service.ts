import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 🎫 GET MY TICKETS
   *
   * Retrieve all tickets for the authenticated user with optional filtering.
   *
   * @param userId - Authenticated user ID
   * @param status - Filter: 'upcoming', 'past', or 'all'
   * @param page - Page number (1-indexed)
   * @param pageSize - Items per page
   */
  async getMyTickets(
    userId: string,
    status: string = 'upcoming',
    page: number = 1,
    pageSize: number = 10,
  ) {
    const now = new Date();
    const skip = (page - 1) * pageSize;

    // Build date filter based on status
    let dateFilter: any = {};
    if (status === 'upcoming') {
      dateFilter = { gte: now };
    } else if (status === 'past') {
      dateFilter = { lt: now };
    }
    // 'all' = no date filter

    const whereClause: any = {
      userId,
      event: {
        deletedAt: null, // Exclude cancelled events
      },
    };

    if (Object.keys(dateFilter).length > 0) {
      whereClause.event.dateTime = dateFilter;
    }

    // Query tickets with event details
    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where: whereClause,
        include: {
          event: {
            select: {
              id: true,
              title: true,
              description: true,
              dateTime: true,
              location: true,
              entryPrice: true,
            },
          },
        },
        orderBy: [{ event: { dateTime: 'asc' } }, { issuedAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.ticket.count({ where: whereClause }),
    ]);

    // Format response
    const formattedTickets = tickets.map((ticket) => ({
      id: ticket.id,
      ticketCode: ticket.ticketCode,
      event: {
        id: ticket.event.id,
        title: ticket.event.title,
        description: ticket.event.description,
        dateTime: ticket.event.dateTime,
        location: ticket.event.location,
        entryPrice: Number(ticket.event.entryPrice),
      },
      checkedIn: !!ticket.checkedInAt,
      checkedInAt: ticket.checkedInAt,
      issuedAt: ticket.issuedAt,
    }));

    return {
      tickets: formattedTickets,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 🔍 GET TICKET BY CODE
   *
   * Retrieve ticket details by ticket code.
   *
   * Authorization:
   * - Ticket owner can view
   * - Event creator can view (for verification at entrance)
   *
   * @param ticketCode - Unique ticket identifier
   * @param userId - Requesting user ID
   */
  async getTicketByCode(ticketCode: string, userId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketCode },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            description: true,
            dateTime: true,
            location: true,
            entryPrice: true,
            inviterId: true,
            deletedAt: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Check authorization: ticket owner or event creator
    const isOwner = ticket.userId === userId;
    const isEventCreator = ticket.event.inviterId === userId;

    if (!isOwner && !isEventCreator) {
      throw new ForbiddenException(
        'You do not have permission to view this ticket',
      );
    }

    // Check if ticket is valid
    const isValid = !ticket.event.deletedAt;

    // Format response (hide sensitive user info unless event creator)
    const response: any = {
      id: ticket.id,
      ticketCode: ticket.ticketCode,
      event: {
        id: ticket.event.id,
        title: ticket.event.title,
        description: ticket.event.description,
        dateTime: ticket.event.dateTime,
        location: ticket.event.location,
        entryPrice: Number(ticket.event.entryPrice),
      },
      checkedIn: !!ticket.checkedInAt,
      checkedInAt: ticket.checkedInAt,
      isValid,
      issuedAt: ticket.issuedAt,
    };

    // Only show holder details to event creator (for check-in verification)
    if (isEventCreator) {
      response.holder = {
        id: ticket.user.id,
        name: ticket.user.name || 'Anonymous',
        email: ticket.user.email,
      };
    }

    return response;
  }

  /**
   * 🔍 GET TICKET BY ID
   *
   * Retrieve ticket details by ticket ID.
   * Same authorization as getTicketByCode.
   */
  async getTicketById(ticketId: string, userId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            description: true,
            dateTime: true,
            location: true,
            entryPrice: true,
            inviterId: true,
            deletedAt: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Check authorization
    const isOwner = ticket.userId === userId;
    const isEventCreator = ticket.event.inviterId === userId;

    if (!isOwner && !isEventCreator) {
      throw new ForbiddenException(
        'You do not have permission to view this ticket',
      );
    }

    const isValid = !ticket.event.deletedAt;

    const response: any = {
      id: ticket.id,
      ticketCode: ticket.ticketCode,
      event: {
        id: ticket.event.id,
        title: ticket.event.title,
        description: ticket.event.description,
        dateTime: ticket.event.dateTime,
        location: ticket.event.location,
        entryPrice: Number(ticket.event.entryPrice),
      },
      checkedIn: !!ticket.checkedInAt,
      checkedInAt: ticket.checkedInAt,
      isValid,
      issuedAt: ticket.issuedAt,
    };

    if (isEventCreator) {
      response.holder = {
        id: ticket.user.id,
        name: ticket.user.name || 'Anonymous',
        email: ticket.user.email,
      };
    }

    return response;
  }

  /**
   * ✅ CHECK-IN TICKET
   *
   * Mark ticket as used when attendee arrives at event.
   *
   * Authorization: Event creator only
   *
   * Business Rules:
   * - Ticket must exist and belong to this event
   * - Ticket cannot already be used
   * - Check-in window: 2 hours before event start until event end (or +2 hours)
   * - Event must not be cancelled
   *
   * @param eventId - Event ID (from URL)
   * @param ticketCode - Ticket code (from QR scan)
   * @param userId - Event creator checking in the ticket
   */
  async checkinTicket(eventId: string, ticketCode: string, userId: string) {
    // 1. Fetch ticket with event details
    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketCode },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            dateTime: true,
            inviterId: true,
            deletedAt: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // 2. Verify ticket belongs to this event
    if (ticket.eventId !== eventId) {
      throw new ForbiddenException(
        `This ticket is for "${ticket.event.title}", not the current event.`,
      );
    }

    // 3. Verify user is event creator
    if (ticket.event.inviterId !== userId) {
      throw new ForbiddenException(
        'Only the event creator can check-in tickets',
      );
    }

    // 4. Check if event is cancelled
    if (ticket.event.deletedAt) {
      throw new ConflictException('This event has been cancelled');
    }

    // 5. Check if ticket already used
    if (ticket.checkedInAt) {
      throw new ConflictException(
        `Ticket already checked in at ${ticket.checkedInAt.toLocaleString()}`,
      );
    }

    // 6. Validate check-in time window
    const now = new Date();
    const eventDate = new Date(ticket.event.dateTime);
    const checkInStart = new Date(eventDate.getTime() - 2 * 60 * 60 * 1000); // 2 hours before
    const checkInEnd = new Date(eventDate.getTime() + 4 * 60 * 60 * 1000); // Event + 2 hours buffer

    if (now < checkInStart) {
      const hoursUntil = Math.ceil(
        (checkInStart.getTime() - now.getTime()) / (60 * 60 * 1000),
      );
      throw new ForbiddenException(
        `Check-in opens in ${hoursUntil} hour(s) at ${checkInStart.toLocaleTimeString()}. Check-in window is 2 hours before to 2 hours after the event.`,
      );
    }

    if (now > checkInEnd) {
      throw new ForbiddenException('Check-in window has closed for this event');
    }

    // 7. Mark ticket as used
    const updatedTicket = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { checkedInAt: now },
    });

    this.logger.log(
      `Ticket ${ticketCode} checked in for event ${eventId} by user ${userId}`,
    );

    // 8. Return success response with attendee info
    return {
      success: true,
      message: 'Check-in successful',
      attendee: {
        name: ticket.user.name || 'Anonymous',
        email: ticket.user.email,
        ticketCode: ticket.ticketCode,
        checkedInAt: updatedTicket.checkedInAt,
      },
    };
  }
}
