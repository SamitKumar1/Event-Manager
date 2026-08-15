import { IsString, IsOptional } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}