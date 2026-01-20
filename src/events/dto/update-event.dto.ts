import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

/**
 * DTO for updating event details.
 *
 * All fields are optional - only send what needs to be updated.
 *
 * Business Rules Enforced in Service:
 * - title, description, location, isPrivate: Always allowed
 * - dateTime: Can't set to past, can't change after event started
 * - entryPrice: BLOCKED if any confirmed attendees exist
 * - maxAttendees: Can increase freely, can decrease only if >= confirmed + pending count
 */
export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  description?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateTime?: Date;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  entryPrice?: number;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxAttendees?: number;
}
