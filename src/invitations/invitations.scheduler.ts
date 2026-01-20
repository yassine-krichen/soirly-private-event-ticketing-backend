import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvitationStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * 🧹 INVITATIONS SCHEDULER
 *
 * Background jobs for invitation management.
 *
 * JOB 1: Auto-expire abandoned PENDING invitations
 * - Runs: Every hour
 * - Target: Invitations that are PENDING for > 24 hours without payment
 * - Action: Update status to DECLINED, set declinedAt timestamp
 * - Why: Frees up event capacity from users who never paid
 */
@Injectable()
export class InvitationsScheduler {
  private readonly logger = new Logger(InvitationsScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 🕐 CRON JOB: Expire Old Pending Invitations
   *
   * Runs every hour at minute 0 (e.g., 1:00, 2:00, 3:00)
   *
   * LOGIC:
   * 1. Find invitations where:
   *    - status = PENDING
   *    - createdAt < (now - 24 hours)
   *    - No successful payment exists
   * 2. Update them to DECLINED
   * 3. This frees up spots for other users
   *
   * EXAMPLE:
   * - User joins event Monday 2pm → invitation PENDING
   * - User never pays
   * - Tuesday 3pm → this job runs → invitation DECLINED
   * - Spot now available for someone else
   */
  @Cron(CronExpression.EVERY_HOUR)
  async expireOldPendingInvitations() {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    this.logger.log(
      `Running auto-cleanup: expiring PENDING invitations older than ${cutoffTime.toISOString()}`,
    );

    try {
      // Find old PENDING invitations without successful payment
      const expiredInvitations = await this.prisma.eventInvitation.findMany({
        where: {
          status: InvitationStatus.PENDING,
          createdAt: {
            lt: cutoffTime,
          },
          payments: {
            none: {
              status: 'SUCCESS',
            },
          },
        },
        select: {
          id: true,
          userId: true,
          eventId: true,
          createdAt: true,
        },
      });

      if (expiredInvitations.length === 0) {
        this.logger.log('No expired invitations found');
        return;
      }

      // Update them to DECLINED
      const result = await this.prisma.eventInvitation.updateMany({
        where: {
          id: {
            in: expiredInvitations.map((inv) => inv.id),
          },
        },
        data: {
          status: InvitationStatus.DECLINED,
          declinedAt: new Date(),
        },
      });

      this.logger.log(
        `✅ Auto-cleanup completed: ${result.count} invitation(s) expired (freed event capacity)`,
      );

      // Log details for debugging
      expiredInvitations.forEach((inv) => {
        this.logger.debug(
          `Expired invitation ${inv.id}: user ${inv.userId}, event ${inv.eventId}, age ${Math.round((Date.now() - inv.createdAt.getTime()) / (60 * 60 * 1000))}h`,
        );
      });
    } catch (error) {
      this.logger.error('Failed to expire old invitations:', error);
    }
  }

  /**
   * 📊 OPTIONAL: Log Invitation Stats
   *
   * Runs daily at 9 AM
   * Provides visibility into invitation health
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async logInvitationStats() {
    try {
      const stats = await this.prisma.eventInvitation.groupBy({
        by: ['status'],
        _count: true,
      });

      this.logger.log('📊 Daily Invitation Stats:');
      stats.forEach((stat) => {
        this.logger.log(`  ${stat.status}: ${stat._count} invitation(s)`);
      });
    } catch (error) {
      this.logger.error('Failed to log invitation stats:', error);
    }
  }
}
