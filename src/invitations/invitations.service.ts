import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
  GoneException,
} from '@nestjs/common';
import { InvitationStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { EventsService } from '../events/events.service';

/**
 * 📨 INVITATIONS SERVICE
 *
 * Business logic for managing event invitations.
 */
@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  /**
   * 🎯 JOIN EVENT VIA INVITE TOKEN
   *
   * Creates an EventInvitation record when user wants to join an event.
   * This is the FIRST STEP in the user journey (before payment).
   *
   * FLOW:
   * 1. User clicks invite link and authenticates
   * 2. Calls this method with inviteToken
   * 3. We create invitation with status = PENDING
   * 4. User can now proceed to payment
   *
   * VALIDATIONS:
   * - Invite token must exist and be active
   * - Event must not have passed
   * - User cannot join their own event
   * - Event must not be at capacity
   *
   * IDEMPOTENCY:
   * - If invitation already exists:
   *   - CONFIRMED: Return "already attending"
   *   - PENDING: Return existing invitation
   *   - DECLINED: Reactivate (change to PENDING)
   */
  async joinEventViaInvite(inviteToken: string, userId: string) {
    this.logger.log(
      `User ${userId} attempting to join event via token ${inviteToken}`,
    );

    // 1. Find event by invite token
    const event = await this.prisma.event.findUnique({
      where: { inviteToken },
      include: {
        _count: {
          select: {
            invitations: {
              // Count PENDING + CONFIRMED (not DECLINED)
              // PENDING counts because they've reserved a spot even if not paid yet
              where: {
                status: {
                  in: [InvitationStatus.PENDING, InvitationStatus.CONFIRMED],
                },
              },
            },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Invalid invite link');
    }

    // 2. Verify invite link is active
    if (!event.inviteLinkActive) {
      throw new ForbiddenException(
        'This invitation link is no longer active. Contact the event organizer.',
      );
    }

    // 3. Verify event hasn't passed
    if (new Date(event.dateTime) < new Date()) {
      throw new GoneException('This event has already occurred');
    }

    // 4. Verify user is not the event creator
    if (event.inviterId === userId) {
      throw new ForbiddenException(
        'Event creators cannot join their own events',
      );
    }

    // 5. Check if event is at capacity
    if (event.maxAttendees) {
      const activeInvitations = event._count.invitations;
      if (activeInvitations >= event.maxAttendees) {
        throw new ConflictException(
          `Event is at full capacity (${event.maxAttendees} attendees). ${activeInvitations} spots already taken.`,
        );
      }
    }

    // 6. Check if user already has an invitation
    const existingInvitation = await this.prisma.eventInvitation.findUnique({
      where: {
        eventId_userId: {
          eventId: event.id,
          userId,
        },
      },
    });

    // If invitation exists, handle based on status
    if (existingInvitation) {
      if (existingInvitation.status === InvitationStatus.CONFIRMED) {
        this.logger.log(`User ${userId} already attending event ${event.id}`);
        return {
          invitation: existingInvitation,
          message: 'You are already attending this event',
          alreadyAttending: true,
        };
      }

      if (existingInvitation.status === InvitationStatus.PENDING) {
        this.logger.log(
          `User ${userId} already has pending invitation to event ${event.id}`,
        );
        return {
          invitation: existingInvitation,
          message:
            'You have already joined this event. Proceed to payment to confirm.',
          nextStep: 'PAYMENT',
        };
      }

      if (existingInvitation.status === InvitationStatus.DECLINED) {
        // User previously declined, allow them to re-join
        this.logger.log(`Reactivating declined invitation for user ${userId}`);
        const updated = await this.prisma.eventInvitation.update({
          where: { id: existingInvitation.id },
          data: {
            status: InvitationStatus.PENDING,
            declinedAt: null,
          },
        });

        return {
          invitation: updated,
          message: 'Welcome back! Your invitation has been reactivated.',
          nextStep: 'PAYMENT',
        };
      }
    }

    // 7. Create new invitation
    const invitation = await this.prisma.eventInvitation.create({
      data: {
        eventId: event.id,
        userId,
        status: InvitationStatus.PENDING,
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            description: true,
            dateTime: true,
            location: true,
            entryPrice: true,
            maxAttendees: true,
          },
        },
      },
    });

    this.logger.log(
      `Created invitation ${invitation.id} for user ${userId} to event ${event.id}`,
    );

    return {
      invitation,
      message:
        'Successfully joined the event! Please complete payment to confirm your attendance.',
      nextStep: 'PAYMENT',
    };
  }

  /**
   * ❌ DECLINE INVITATION
   *
   * User explicitly declines an invitation.
   * Also cancels any pending payments.
   * User can re-join later if they change their mind.
   */
  async declineInvitation(invitationId: string, userId: string) {
    this.logger.log(`User ${userId} declining invitation ${invitationId}`);

    // Find invitation and verify ownership
    const invitation = await this.prisma.eventInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.userId !== userId) {
      throw new ForbiddenException('You can only decline your own invitations');
    }

    if (invitation.status === InvitationStatus.CONFIRMED) {
      throw new ConflictException(
        'Cannot decline a confirmed invitation. Please contact the event organizer for refunds.',
      );
    }

    // Update invitation to DECLINED
    const declined = await this.prisma.eventInvitation.update({
      where: { id: invitationId },
      data: {
        status: InvitationStatus.DECLINED,
        declinedAt: new Date(),
      },
    });

    // TODO: Cancel any pending payments for this invitation (Phase 3)

    this.logger.log(`Invitation ${invitationId} declined successfully`);

    return {
      invitation: declined,
      message: 'Invitation declined. You can re-join anytime before the event.',
    };
  }

  /**
   * 📋 GET MY INVITATIONS
   *
   * Retrieve all invitations for the authenticated user with optional filtering.
   *
   * @param userId - Authenticated user ID
   * @param status - Filter: 'all', 'pending', 'confirmed', 'declined'
   * @param page - Page number (1-indexed)
   * @param pageSize - Items per page
   */
  async getMyInvitations(
    userId: string,
    status: string = 'all',
    page: number = 1,
    pageSize: number = 20,
  ) {
    const skip = (page - 1) * pageSize;

    // Build status filter
    const statusMap: Record<string, InvitationStatus[]> = {
      all: [
        InvitationStatus.PENDING,
        InvitationStatus.CONFIRMED,
        InvitationStatus.DECLINED,
      ],
      pending: [InvitationStatus.PENDING],
      confirmed: [InvitationStatus.CONFIRMED],
      declined: [InvitationStatus.DECLINED],
    };

    const statuses = statusMap[status] || statusMap.all;

    // Query invitations with event details
    const [invitations, total] = await Promise.all([
      this.prisma.eventInvitation.findMany({
        where: {
          userId,
          status: { in: statuses },
          event: {
            deletedAt: null, // Exclude cancelled events
          },
        },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              description: true,
              dateTime: true,
              location: true,
              entryPrice: true,
              maxAttendees: true,
            },
          },
        },
        orderBy: [{ event: { dateTime: 'asc' } }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.eventInvitation.count({
        where: {
          userId,
          status: { in: statuses },
          event: {
            deletedAt: null,
          },
        },
      }),
    ]);

    // Format response
    const formattedInvitations = invitations.map((inv) => ({
      id: inv.id,
      status: inv.status,
      event: {
        id: inv.event.id,
        title: inv.event.title,
        description: inv.event.description,
        dateTime: inv.event.dateTime,
        location: inv.event.location,
        entryPrice: Number(inv.event.entryPrice),
        maxAttendees: inv.event.maxAttendees,
      },
      createdAt: inv.createdAt,
      confirmedAt: inv.confirmedAt,
      declinedAt: inv.declinedAt,
    }));

    return {
      invitations: formattedInvitations,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 🔍 GET INVITATION BY ID
   *
   * Retrieve detailed invitation information.
   *
   * Authorization:
   * - Invitation owner can view
   * - Event creator can view (to check invitation status)
   */
  async getInvitationById(invitationId: string, userId: string) {
    const invitation = await this.prisma.eventInvitation.findUnique({
      where: { id: invitationId },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            description: true,
            dateTime: true,
            location: true,
            entryPrice: true,
            maxAttendees: true,
            inviterId: true,
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

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    // Check authorization: invitation owner or event creator
    const isOwner = invitation.userId === userId;
    const isEventCreator = invitation.event.inviterId === userId;

    if (!isOwner && !isEventCreator) {
      throw new ForbiddenException(
        'You do not have permission to view this invitation',
      );
    }

    // Format response (hide user details unless event creator)
    const response: any = {
      id: invitation.id,
      status: invitation.status,
      event: {
        id: invitation.event.id,
        title: invitation.event.title,
        description: invitation.event.description,
        dateTime: invitation.event.dateTime,
        location: invitation.event.location,
        entryPrice: Number(invitation.event.entryPrice),
        maxAttendees: invitation.event.maxAttendees,
      },
      createdAt: invitation.createdAt,
      confirmedAt: invitation.confirmedAt,
      declinedAt: invitation.declinedAt,
    };

    // Only show user details to event creator
    if (isEventCreator) {
      response.user = {
        id: invitation.user.id,
        name: invitation.user.name || 'Anonymous',
        email: invitation.user.email,
      };
    }

    return response;
  }

  /**
   * 🔍 FIND PENDING INVITATION
   *
   * Helper method to check if user has a PENDING invitation for an event.
   * Used by PaymentsService to validate payment creation.
   */
  async findPendingInvitation(eventId: string, userId: string) {
    return this.prisma.eventInvitation.findFirst({
      where: {
        eventId,
        userId,
        status: InvitationStatus.PENDING,
      },
    });
  }
}
