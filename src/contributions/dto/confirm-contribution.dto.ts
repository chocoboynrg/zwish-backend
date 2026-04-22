import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmContributionDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
