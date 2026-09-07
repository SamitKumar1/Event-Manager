import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PaymentProvider } from './payment-provider.interface';

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  constructor(private config: ConfigService) {}

  async charge(amount: number, _currency: string, _metadata?: Record<string, string>) {
    // Deterministic rule: succeed if amount > 0 and optional config flag
    const shouldFail = this.config.get('MOCK_PAYMENT_FORCE_FAIL') === 'true';
    if (shouldFail || amount <= 0) {
      return {
        providerPaymentId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        succeeded: false,
      };
    }
    return {
      providerPaymentId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      succeeded: true,
    };
  }
}