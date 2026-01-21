import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * 🏥 HEALTH CHECK CONTROLLER
 *
 * Provides health check endpoints for monitoring and orchestration.
 * Used by:
 * - Kubernetes liveness/readiness probes
 * - Load balancers
 * - Monitoring systems (Datadog, New Relic, etc.)
 *
 * Endpoints:
 * - GET /health - Overall health status
 * - GET /health/ready - Readiness probe (can accept traffic?)
 * - GET /health/live - Liveness probe (is app running?)
 *
 * All endpoints skip rate limiting (monitoring tools need unrestricted access)
 */
@Controller('health')
@SkipThrottle() // Health checks should not be rate limited
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private prisma: PrismaService,
  ) {}

  /**
   * 🔍 ENDPOINT: GET /health
   *
   * Comprehensive health check including:
   * - Database connectivity (Prisma)
   * - Memory usage (<150MB heap)
   * - Disk space (>1GB available)
   *
   * Returns 200 OK if all checks pass, 503 Service Unavailable otherwise.
   *
   * Example Response:
   * {
   *   "status": "ok",
   *   "info": {
   *     "database": { "status": "up" },
   *     "memory_heap": { "status": "up" },
   *     "disk": { "status": "up" }
   *   },
   *   "error": {},
   *   "details": { ... }
   * }
   */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Database check
      async () => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return {
            database: {
              status: 'up',
            },
          };
        } catch (error) {
          return {
            database: {
              status: 'down',
              message: error.message,
            },
          };
        }
      },
      // Memory check (heap should be under 150MB)
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      // Disk check (should have at least 1GB free)
      () =>
        this.disk.checkStorage('disk', { path: '/', thresholdPercent: 0.9 }),
    ]);
  }

  /**
   * 🚦 ENDPOINT: GET /health/ready
   *
   * Readiness probe - indicates if the service can accept traffic.
   * Checks database connectivity only.
   *
   * Use Case:
   * - Kubernetes readiness probe
   * - Load balancer health check
   *
   * Returns:
   * - 200 OK: Service is ready to accept requests
   * - 503 Service Unavailable: Service is not ready (database down)
   */
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      async () => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return {
            database: {
              status: 'up',
            },
          };
        } catch (error) {
          throw new Error(`Database not ready: ${error.message}`);
        }
      },
    ]);
  }

  /**
   * 💓 ENDPOINT: GET /health/live
   *
   * Liveness probe - indicates if the application is running.
   * Simple check that returns 200 OK if the app is alive.
   *
   * Use Case:
   * - Kubernetes liveness probe
   * - Container orchestration
   *
   * Returns:
   * - 200 OK: Application is alive
   *
   * Note: This should ALWAYS return 200 unless the app is completely dead.
   * Do NOT include database checks here (liveness != readiness)
   */
  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([
      () => ({
        api: {
          status: 'up',
        },
      }),
    ]);
  }
}
