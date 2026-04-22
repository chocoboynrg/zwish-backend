import { IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @MinLength(20)
  @MaxLength(255)
  token: string;
}
