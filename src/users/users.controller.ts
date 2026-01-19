import { Controller, ForbiddenException, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Get(':id/events')
	async listInviterEvents(@Param('id') id: string, @Req() req: any) {
		if (req.user.sub !== id) {
			throw new ForbiddenException('You can only view your own events');
		}

		return this.usersService.findEventsByInviter(id);
	}
}
