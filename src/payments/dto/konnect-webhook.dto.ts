import { IsEnum, IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';
import { PaymentStatus } from '@prisma/client';

export class KonnectWebhookDto {
  @IsString()
  @IsNotEmpty()
  reference!: string;

  @IsEnum(PaymentStatus)
  status!: PaymentStatus;

  @IsNumber()
  @IsPositive()
  amount!: number;
}
