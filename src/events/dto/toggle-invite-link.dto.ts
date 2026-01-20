import { IsBoolean } from 'class-validator';

/**
 * DTO for toggling invite link on/off
 */
export class ToggleInviteLinkDto {
  @IsBoolean()
  active!: boolean;
}
