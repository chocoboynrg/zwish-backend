import { IsEnum, IsInt, IsNotEmpty, Min } from 'class-validator';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';

export class CreatePaymentDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  contributionId: number;

  @IsEnum(PaymentProvider)
  provider: PaymentProvider;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
