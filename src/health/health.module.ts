import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { CommonModule } from '../common/common.module';

/**
 * 🏥 HEALTH MODULE
 *
 * Provides health check endpoints using @nestjs/terminus.
 *
 * Features:
 * - Database connectivity checks
 * - Memory usage monitoring
 * - Disk space monitoring
 * - Readiness and liveness probes
 */
@Module({
  imports: [
    TerminusModule,
    HttpModule,
    CommonModule, // For PrismaService
  ],
  controllers: [HealthController],
})
export class HealthModule {}
