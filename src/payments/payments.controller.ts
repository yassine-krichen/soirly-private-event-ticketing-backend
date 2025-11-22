import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { KonnectWebhookDto } from './dto/konnect-webhook.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
	constructor(private readonly paymentsService: PaymentsService) {}

	@Post()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.INVITEE)
	create(@Req() req: any, @Body() dto: CreatePaymentDto) {
		return this.paymentsService.createPayment(req.user, dto);
	}

	@Get(':id/status')
	@UseGuards(JwtAuthGuard)
	status(@Param('id') id: string) {
		return this.paymentsService.getStatus(id);
	}

	@Post('webhook')
	webhook(
		@Headers('x-konnect-signature') signature: string | undefined,
		@Body() dto: KonnectWebhookDto,
	) {
		return this.paymentsService.processWebhook(signature, dto);
	}
}
