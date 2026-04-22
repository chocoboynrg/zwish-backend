// import { Injectable, Logger } from '@nestjs/common';
// import { HttpService } from '@nestjs/axios';
// import { firstValueFrom } from 'rxjs';
// import { ConfigService } from '@nestjs/config';
// import { PaymentProvider } from '../enums/payment-provider.enum';
// import {
//   CreateExternalPaymentInput,
//   CreateExternalPaymentResult,
//   PaymentProviderAdapter,
// } from './payment-provider.interface';

// @Injectable()
// export class FedaPayPaymentProvider implements PaymentProviderAdapter {
//   readonly provider = PaymentProvider.FEDAPAY;
//   private readonly logger = new Logger(FedaPayPaymentProvider.name);

//   constructor(
//     private readonly http: HttpService,
//     private readonly config: ConfigService,
//   ) {}

//   async createPaymentSession(
//     input: CreateExternalPaymentInput,
//   ): Promise<CreateExternalPaymentResult> {
//     const apiKey = this.config.get<string>('FEDAPAY_API_KEY');
//     const baseUrl = this.config.get<string>('FEDAPAY_API_BASE_URL');
//     const callbackUrl = this.config.get<string>('FEDAPAY_CALLBACK_URL');

//     // 1. créer transaction
//     const transactionPayload = {
//       description: input.description || 'Wishlist payment',
//       amount: input.amount,
//       currency: {
//         iso: input.currencyCode,
//       },
//       callback_url: callbackUrl,
//       custom_metadata: {
//         paymentId: input.paymentId,
//         //contributionId: input.contributionId,
//       },
//     };

//     let transaction;

//     try {
//       const response = await firstValueFrom(
//         this.http.post(`${baseUrl}/transactions`, transactionPayload, {
//           headers: {
//             Authorization: `Bearer ${apiKey}`,
//             'Content-Type': 'application/json',
//           },
//         }),
//       );

//       transaction = response.data;
//     } catch (error) {
//       this.logger.error(
//         'FedaPay transaction creation failed',
//         error?.response?.data || error,
//       );
//       throw error;
//     }

//     // 2. générer lien paiement
//     let token;

//     try {
//       const response = await firstValueFrom(
//         this.http.post(
//           `${baseUrl}/transactions/${transaction.id}/token`,
//           {},
//           {
//             headers: {
//               Authorization: `Bearer ${apiKey}`,
//             },
//           },
//         ),
//       );

//       token = response.data;
//     } catch (error) {
//       this.logger.error(
//         'FedaPay token generation failed',
//         error?.response?.data || error,
//       );
//       throw error;
//     }

//     return {
//       provider: PaymentProvider.FEDAPAY,
//       providerReference: transaction.reference,
//       providerTransactionId: String(transaction.id),
//       paymentUrl: token.url,
//       rawPayload: {
//         transaction,
//         token,
//       },
//     };
//   }
// }
