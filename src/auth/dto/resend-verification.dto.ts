import { IsEmail, MaxLength } from 'class-validator';

export class ResendVerificationDto {
  @IsEmail()
  @MaxLength(190)
  email: string;
}
