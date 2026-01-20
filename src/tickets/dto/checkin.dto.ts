import { IsString, IsUUID } from 'class-validator';

/**
 * DTO for checking in a ticket at event entrance.
 */
export class CheckinDto {
  @IsString()
  @IsUUID()
  ticketCode!: string;
}
