import { Controller, ForbiddenException, Get, Param, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Get(':id/events')
	@Roles(UserRole.INVITER)
	async listInviterEvents(@Param('id') id: string, @Req() req: any) {
		if (req.user.sub !== id) {
			throw new ForbiddenException('You can only view your own events');
		}

		return this.usersService.findEventsByInviter(id);
	}
}
