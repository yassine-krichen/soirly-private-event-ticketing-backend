import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * EventAccessGuard - Security Guard for Event Details
 * 
 * PURPOSE:
 * This guard protects event endpoints from unauthorized access.
 * Events are PRIVATE by default, so we need to check if the user
 * has permission to view the event details.
 * 
 * WHO CAN ACCESS AN EVENT:
 * 1. The person who created the event (event.inviterId === user.id)
 * 2. Anyone who has clicked the invite link (has an EventInvitation record)
 * 3. Admins (for support/moderation)
 * 
 * FLOW:
 * - User sends request to GET /events/:id
 * - JwtAuthGuard validates JWT token first (checks if authenticated)
 * - Then THIS guard runs to check if they can access THIS specific event
 * - If they pass: event details returned
 * - If they fail: 403 Forbidden error
 * 
 * USAGE:
 * Add to controller like this:
 * @UseGuards(JwtAuthGuard, EventAccessGuard)
 */
@Injectable()
export class EventAccessGuard implements CanActivate {
  private readonly logger = new Logger(EventAccessGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * This method runs BEFORE the controller endpoint
   * Returns true = allow access
   * Returns false or throws exception = deny access
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get the HTTP request object
    const request = context.switchToHttp().getRequest();
    
    // user comes from JWT token (decoded by JwtAuthGuard)
    // It has: { sub: userId, email: userEmail, role: USER/ADMIN }
    const user = request.user;
    
    // eventId comes from URL parameter (e.g., /events/123-abc-456)
    const eventId = request.params.id;

    // Sanity check: make sure we have both
    if (!user || !eventId) {
      this.logger.warn('Missing user or eventId in request');
      return false; // Deny access
    }

    // RULE 1: Admins can access everything (for moderation/support)
    if (user.role === Role.ADMIN) {
      this.logger.log(`Admin ${user.sub} accessing event ${eventId}`);
      return true; // Allow access
    }

    // RULE 2 & 3: Check if user is event creator OR has invitation
    // We query the database to get the event
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        inviterId: true, // Who created this event?
        invitations: {
          // Get invitations for THIS user only
          where: { userId: user.sub },
          select: { id: true }, // We just need to know if it exists
        },
      },
    });

    // Event doesn't exist in database
    if (!event) {
      throw new ForbiddenException('Event not found');
    }

    // Check if user created this event
    const isCreator = event.inviterId === user.sub;
    
    // Check if user has clicked invite link (invitation exists)
    const hasInvitation = event.invitations.length > 0;

    // If neither creator nor invited, DENY access
    if (!isCreator && !hasInvitation) {
      this.logger.warn(
        `User ${user.sub} attempted to access event ${eventId} without permission`,
      );
      throw new ForbiddenException(
        'You do not have permission to access this event',
      );
    }

    // User passed all checks, ALLOW access
    this.logger.log(`User ${user.sub} authorized to access event ${eventId}`);
    return true;
  }
}
