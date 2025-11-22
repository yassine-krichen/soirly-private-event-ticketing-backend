import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';

export class GoogleAuthDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
