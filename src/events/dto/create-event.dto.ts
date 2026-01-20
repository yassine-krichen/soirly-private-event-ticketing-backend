import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @IsOptional()
  @MinLength(10)
  description?: string;

  @Type(() => Date)
  @IsDate()
  dateTime!: Date;

  @IsString()
  @IsOptional()
  location?: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  entryPrice!: number;

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Min(1)
  @IsOptional()
  maxAttendees?: number;
}
