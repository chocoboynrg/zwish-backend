import { Injectable } from '@nestjs/common';
import {
  CreateExternalPaymentInput,
  CreateExternalPaymentResult,
  PaymentProviderAdapter,
} from './payment-provider.interface';
import { PaymentProvider } from '../enums/payment-provider.enum';

@Injectable()
export class MockPaymentProvider implements PaymentProviderAdapter {
  readonly provider = PaymentProvider.OTHER;

  async createPaymentSession(
    input: CreateExternalPaymentInput,
  ): Promise<CreateExternalPaymentResult> {
    return {
      provider: this.provider,
      providerReference: `mock-ref-${input.paymentId}`,
      providerTransactionId: `mock-tx-${input.paymentId}`,
      paymentUrl: `https://example.com/mock-pay/${input.paymentId}`,
      rawPayload: {
        mode: 'mock',
        paymentId: input.paymentId,
      },
    };
  }
}
