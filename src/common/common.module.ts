import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PrismaService } from './prisma/prisma.service';

@Module({
	providers: [PrismaService, RolesGuard, JwtAuthGuard],
	exports: [PrismaService, RolesGuard, JwtAuthGuard],
})
export class CommonModule {}
