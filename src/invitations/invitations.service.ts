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
