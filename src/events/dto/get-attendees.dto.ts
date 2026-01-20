import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum AttendeeStatusFilter {
  ALL = 'all',
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  DECLINED = 'declined',
}

/**
 * DTO for querying event attendees with pagination and filters.
 */
export class GetAttendeesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @IsEnum(AttendeeStatusFilter)
  status?: AttendeeStatusFilter = AttendeeStatusFilter.CONFIRMED;
}
