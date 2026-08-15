export interface PaymentProvider {
  charge(amount: number, currency: string, metadata?: Record<string, string>): Promise<{
    providerPaymentId: string;
    succeeded: boolean;
  }>;
}