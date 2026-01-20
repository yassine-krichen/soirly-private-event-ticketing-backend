import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InvitationStatus, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { AttendeeStatusFilter } from './dto/get-attendees.dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly appBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.appBaseUrl = this.configService.get<string>(
      'APP_BASE_URL',
      'http://localhost:3000',
    );
  }

  /**
   * 📝 CREATE EVENT
   *
   * Creates a new event with auto-generated invite token.
   * isPrivate defaults to true if not specified.
   */
  create(inviterId: string, dto: CreateEventDto) {
    return this.prisma.event.create({
      data: {
        ...dto,
        entryPrice: new Prisma.Decimal(dto.entryPrice),
        inviterId,
        isPrivate: dto.isPrivate ?? true, // Default to true if not provided
      },
    });
  }

  /**
   * 🔍 FIND EVENT BY ID
   */
  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  /**
   * 📋 LIST EVENTS FOR INVITER
   */
  async listForInviter(inviterId: string) {
    return this.prisma.event.findMany({
      where: { inviterId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 🌐 GET EVENT BY INVITE TOKEN (Public Access)
   *
   * Returns sanitized event details for public viewing.
   * Does NOT require authentication.
   *
   * Used when someone clicks an invite link before authenticating.
   */
  async getEventByInviteToken(inviteToken: string) {
    const event = await this.prisma.event.findUnique({
      where: { inviteToken },
      include: {
        sponsor: {
          select: {
            name: true,
            logoUrl: true,
          },
        },
        _count: {
          select: {
            invitations: {
              where: { status: InvitationStatus.CONFIRMED },
            },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Invalid invite link');
    }

    if (!event.inviteLinkActive) {
      throw new ForbiddenException(
        'This invitation link is no longer active. Contact the event organizer.',
      );
    }

    // Calculate spots available
    const confirmedCount = event._count.invitations;
    const spotsAvailable = event.maxAttendees
      ? event.maxAttendees - confirmedCount
      : null;

    // Return sanitized event data (no sensitive info)
    return {
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        dateTime: event.dateTime,
        location: event.location,
        entryPrice: Number(event.entryPrice),
        maxAttendees: event.maxAttendees,
        spotsAvailable,
        confirmedAttendees: confirmedCount,
        sponsor: event.sponsor,
      },
      requiresAuth: true,
      inviteLinkActive: event.inviteLinkActive,
    };
  }

  /**
   * 🔗 GET INVITE LINK INFO (Owner Only)
   *
   * Returns invite link and stats for event owner.
   */
  async getInviteLinkInfo(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        _count: {
          select: {
            invitations: {
              where: { status: InvitationStatus.PENDING },
            },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.inviterId !== userId) {
      throw new ForbiddenException(
        'Only event owners can access invite link info',
      );
    }

    // Get invitation stats
    const stats = await this.getInvitationStats(eventId);

    return {
      inviteLink: `${this.appBaseUrl}/events/invite/${event.inviteToken}`,
      inviteToken: event.inviteToken,
      isActive: event.inviteLinkActive,
      stats,
    };
  }

  /**
   * 🔄 TOGGLE INVITE LINK (Owner Only)
   *
   * Enable or disable the invite link.
   */
  async toggleInviteLink(eventId: string, userId: string, active: boolean) {
    const event = await this.findOne(eventId);

    if (event.inviterId !== userId) {
      throw new ForbiddenException('Only event owners can toggle invite link');
    }

    await this.prisma.event.update({
      where: { id: eventId },
      data: { inviteLinkActive: active },
    });

    return {
      inviteLinkActive: active,
      message: active
        ? 'Invite link has been enabled'
        : 'Invite link has been disabled',
    };
  }

  /**
   * 🔁 REGENERATE INVITE TOKEN (Owner Only)
   *
   * Creates a new invite token, invalidating the old one.
   */
  async regenerateInviteToken(eventId: string, userId: string) {
    const event = await this.findOne(eventId);

    if (event.inviterId !== userId) {
      throw new ForbiddenException(
        'Only event owners can regenerate invite token',
      );
    }

    const newToken = randomUUID();

    await this.prisma.event.update({
      where: { id: eventId },
      data: { inviteToken: newToken },
    });

    this.logger.log(
      `Invite token regenerated for event ${eventId}. Old token invalidated.`,
    );

    return {
      inviteToken: newToken,
      inviteLink: `${this.appBaseUrl}/events/invite/${newToken}`,
      message: 'Invite link has been regenerated. Old link is now invalid.',
    };
  }

  /**
   * 📊 GET INVITATION STATS
   *
   * Helper method to get invitation statistics for an event.
   */
  private async getInvitationStats(eventId: string) {
    const [pending, confirmed, declined] = await Promise.all([
      this.prisma.eventInvitation.count({
        where: { eventId, status: InvitationStatus.PENDING },
      }),
      this.prisma.eventInvitation.count({
        where: { eventId, status: InvitationStatus.CONFIRMED },
      }),
      this.prisma.eventInvitation.count({
        where: { eventId, status: InvitationStatus.DECLINED },
      }),
    ]);

    return {
      pendingInvitations: pending,
      confirmedAttendees: confirmed,
      declinedInvitations: declined,
    };
  }

  /**
   * 🔒 VERIFY EVENT OWNERSHIP
   *
   * Helper method to check if user owns an event.
   * Throws ForbiddenException if not.
   */
  async verifyEventOwnership(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { inviterId: true },
    });

    if (!event || event.inviterId !== userId) {
      throw new ForbiddenException('You do not own this event');
    }
  }

  /**
   * ✏️ UPDATE EVENT
   *
   * Update event details with business rule enforcement.
   *
   * Business Rules:
   * - Only event creator can update
   * - title, description, location, isPrivate: Always allowed
   * - dateTime: Cannot set to past, cannot change after event started
   * - entryPrice: BLOCKED if any confirmed attendees exist (fairness)
   * - maxAttendees: Can increase freely, decrease only if >= (confirmed + pending)
   *
   * TODO Phase 9: Notify ticket holders when dateTime/location changes
   */
  async updateEvent(eventId: string, userId: string, dto: UpdateEventDto) {
    // 1. Verify ownership
    await this.verifyEventOwnership(eventId, userId);

    // 2. Fetch event with invitation stats
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        invitations: {
          where: {
            status: {
              in: [InvitationStatus.PENDING, InvitationStatus.CONFIRMED],
            },
          },
          select: { status: true },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const now = new Date();
    const confirmedCount = event.invitations.filter(
      (i) => i.status === InvitationStatus.CONFIRMED,
    ).length;
    const pendingCount = event.invitations.filter(
      (i) => i.status === InvitationStatus.PENDING,
    ).length;
    const totalOccupied = confirmedCount + pendingCount;

    // 3. Validate dateTime if being updated
    if (dto.dateTime) {
      if (dto.dateTime < now) {
        throw new BadRequestException('Cannot set event date to the past');
      }

      if (event.dateTime < now) {
        throw new ForbiddenException(
          'Cannot change date of an event that has already started',
        );
      }

      this.logger.log(
        `Event ${eventId}: dateTime updated. TODO Phase 9: Notify ${confirmedCount} ticket holders`,
      );
    }

    // 4. Validate entryPrice if being updated (STRICT: no changes if attendees)
    if (dto.entryPrice !== undefined && confirmedCount > 0) {
      throw new ForbiddenException(
        `Cannot change entry price. Event has ${confirmedCount} confirmed attendees who already paid. ` +
          `For fairness, all attendees must pay the same price. ` +
          `Please cancel this event and create a new one if you need to change pricing.`,
      );
    }

    // 5. Validate maxAttendees if being updated
    if (dto.maxAttendees !== undefined) {
      if (dto.maxAttendees < totalOccupied) {
        throw new ForbiddenException(
          `Cannot reduce capacity to ${dto.maxAttendees}. ` +
            `You currently have ${totalOccupied} attendees (${confirmedCount} confirmed + ${pendingCount} pending). ` +
            `Please cancel pending invitations first or set capacity to at least ${totalOccupied}.`,
        );
      }

      this.logger.log(
        `Event ${eventId}: maxAttendees updated from ${event.maxAttendees} to ${dto.maxAttendees}`,
      );
    }

    // 6. Prepare update data (handle Decimal conversion for entryPrice)
    const updateData: any = { ...dto };
    if (dto.entryPrice !== undefined) {
      updateData.entryPrice = new Prisma.Decimal(dto.entryPrice);
    }

    // 7. Update event
    const updatedEvent = await this.prisma.event.update({
      where: { id: eventId },
      data: updateData,
    });

    this.logger.log(`Event ${eventId} updated by user ${userId}`);
    return updatedEvent;
  }

  /**
   * 🗑️ DELETE EVENT (Soft Delete)
   *
   * Marks event as deleted (sets deletedAt timestamp).
   *
   * Business Rules:
   * - Only event creator can delete
   * - BLOCKED if event has confirmed attendees (requires refunds - Phase 10)
   * - BLOCKED if event has already occurred (keep for history)
   * - Cancels all PENDING invitations
   * - Deactivates invite link
   * - Keeps payment records (legal requirement)
   * - Marks tickets as invalid
   */
  async deleteEvent(eventId: string, userId: string) {
    // 1. Verify ownership
    await this.verifyEventOwnership(eventId, userId);

    // 2. Fetch event with invitations
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        invitations: {
          where: { status: InvitationStatus.CONFIRMED },
          select: { id: true },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // 3. Block deletion if event has already occurred
    const now = new Date();
    if (event.dateTime < now) {
      throw new ForbiddenException(
        'Cannot delete an event that has already occurred. Events are kept for historical records.',
      );
    }

    // 4. Block deletion if has confirmed attendees (requires refunds)
    const confirmedCount = event.invitations.length;
    if (confirmedCount > 0) {
      throw new ForbiddenException(
        `Cannot delete event with ${confirmedCount} confirmed attendees. ` +
          `Attendees have paid and need refunds. ` +
          `This feature will be available in Phase 10 (Refunds & Cancellations).`,
      );
    }

    // 5. Soft delete event and cancel pending invitations in transaction
    await this.prisma.$transaction(async (tx) => {
      // Mark event as deleted and deactivate invite link
      await tx.event.update({
        where: { id: eventId },
        data: {
          deletedAt: now,
          inviteLinkActive: false,
        },
      });

      // Cancel all pending invitations
      await tx.eventInvitation.updateMany({
        where: {
          eventId,
          status: InvitationStatus.PENDING,
        },
        data: {
          status: InvitationStatus.DECLINED,
          declinedAt: now,
        },
      });

      this.logger.log(
        `Event ${eventId} soft-deleted by user ${userId}. Pending invitations cancelled.`,
      );
    });

    return {
      message: 'Event cancelled successfully',
      eventId,
      deletedAt: now,
    };
  }

  /**
   * 👥 GET EVENT ATTENDEES
   *
   * List all attendees for an event with pagination and filters.
   *
   * Authorization: Event creator or admins only
   *
   * Returns detailed attendee information including:
   * - User details (name, email)
   * - Invitation status
   * - Payment status
   * - Ticket info
   * - Check-in status
   */
  async getAttendees(
    eventId: string,
    userId: string,
    page: number = 1,
    pageSize: number = 20,
    statusFilter: string = 'confirmed',
  ) {
    // 1. Verify ownership (only creator can view attendees for privacy)
    await this.verifyEventOwnership(eventId, userId);

    // 2. Build filter for invitation status
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

    const statuses = statusMap[statusFilter] || [InvitationStatus.CONFIRMED];

    // 3. Query invitations with related data
    const skip = (page - 1) * pageSize;
    const [invitations, total] = await Promise.all([
      this.prisma.eventInvitation.findMany({
        where: {
          eventId,
          status: { in: statuses },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          payments: {
            where: { status: 'SUCCESS' },
            select: {
              id: true,
              amount: true,
              status: true,
              createdAt: true,
              ticket: {
                select: {
                  id: true,
                  ticketCode: true,
                  checkedInAt: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.eventInvitation.count({
        where: {
          eventId,
          status: { in: statuses },
        },
      }),
    ]);

    // 4. Format response
    const attendees = invitations.map((inv) => ({
      id: inv.user.id,
      name: inv.user.name || 'Anonymous',
      email: inv.user.email,
      invitationId: inv.id,
      invitationStatus: inv.status,
      joinedAt: inv.createdAt,
      confirmedAt: inv.confirmedAt,
      payment: inv.payments[0]
        ? {
            id: inv.payments[0].id,
            amount: Number(inv.payments[0].amount),
            status: inv.payments[0].status,
            paidAt: inv.payments[0].createdAt,
          }
        : null,
      ticket: inv.payments[0]?.ticket
        ? {
            id: inv.payments[0].ticket.id,
            ticketCode: inv.payments[0].ticket.ticketCode,
            checkedIn: !!inv.payments[0].ticket.checkedInAt,
            checkedInAt: inv.payments[0].ticket.checkedInAt,
          }
        : null,
    }));

    return {
      attendees,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}
