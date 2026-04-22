import { Injectable, BadRequestException } from '@nestjs/common';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentProviderAdapter } from './payment-provider.interface';
import { MockPaymentProvider } from './mock-payment.provider';
import { PaydunyaPaymentProvider } from './paydunya-payment.provider';
//import { FedaPayPaymentProvider } from './fedapay-payment.provider';

@Injectable()
export class PaymentProviderFactory {
  constructor(
    private readonly mockProvider: MockPaymentProvider,
    private readonly paydunyaProvider: PaydunyaPaymentProvider,
    //private readonly fedapayProvider: FedaPayPaymentProvider,
  ) {}

  get(provider: PaymentProvider): PaymentProviderAdapter {
    switch (provider) {
      case PaymentProvider.OTHER:
        return this.mockProvider;

      case PaymentProvider.PAYDUNYA:
        return this.paydunyaProvider;

      //   case PaymentProvider.FEDAPAY:
      //     return this.fedapayProvider;

      default:
        throw new BadRequestException(`Provider non supporté: ${provider}`);
    }
  }
}
