import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InvitationStatus, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

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
}
