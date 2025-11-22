import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsNumber, IsPositive, IsString, MinLength } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @Type(() => Date)
  @IsDate()
  dateTime!: Date;

  @IsString()
  @IsNotEmpty()
  location!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  entryPrice!: number;
}
