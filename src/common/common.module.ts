import { Module, Global } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PrismaService } from './prisma/prisma.service';
import { CustomLoggerService } from './logger/custom-logger.service';

@Global()
@Module({
  providers: [PrismaService, RolesGuard, JwtAuthGuard, CustomLoggerService],
  exports: [PrismaService, RolesGuard, JwtAuthGuard, CustomLoggerService],
})
export class CommonModule {}
