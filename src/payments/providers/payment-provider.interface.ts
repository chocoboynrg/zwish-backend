import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';

export type CreateExternalPaymentInput = {
  paymentId: number;
  amount: number;
  currencyCode: string;
  paymentMethod: PaymentMethod;
  description: string;
  customer: {
    id: number;
    name: string;
    email: string;
  };
  metadata?: Record<string, unknown>;
};

export type CreateExternalPaymentResult = {
  provider: PaymentProvider;
  providerReference?: string | null;
  providerTransactionId?: string | null;
  paymentUrl?: string | null;
  rawPayload?: unknown;
};

export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;

  createPaymentSession(
    input: CreateExternalPaymentInput,
  ): Promise<CreateExternalPaymentResult>;
}
