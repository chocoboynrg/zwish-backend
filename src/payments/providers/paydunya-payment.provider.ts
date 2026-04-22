import { Injectable, NotImplementedException } from '@nestjs/common';
import {
  CreateExternalPaymentInput,
  CreateExternalPaymentResult,
  PaymentProviderAdapter,
} from './payment-provider.interface';
import { PaymentProvider } from '../enums/payment-provider.enum';

@Injectable()
export class PaydunyaPaymentProvider implements PaymentProviderAdapter {
  readonly provider = PaymentProvider.PAYDUNYA;

  async createPaymentSession(
    input: CreateExternalPaymentInput,
  ): Promise<CreateExternalPaymentResult> {
    const masterKey = process.env.PAYDUNYA_MASTER_KEY;
    const privateKey = process.env.PAYDUNYA_PRIVATE_KEY;
    const publicKey = process.env.PAYDUNYA_PUBLIC_KEY;
    const token = process.env.PAYDUNYA_TOKEN;
    const baseUrl = process.env.PAYDUNYA_BASE_URL;

    if (!masterKey || !privateKey || !publicKey || !token || !baseUrl) {
      throw new NotImplementedException('Configuration PayDunya incomplète');
    }

    // Étape suivante: appel HTTP réel PayDunya sandbox
    throw new NotImplementedException(
      `PayDunya non encore branché pour paymentId=${input.paymentId}`,
    );
  }
}
