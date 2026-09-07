import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { MockPaymentProvider } from './mock-payment.provider';

describe('MockPaymentProvider', () => {
  let provider: MockPaymentProvider;
  let config: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MockPaymentProvider,
        { provide: ConfigService, useValue: { get: jest.fn(() => 'false') } },
      ],
    }).compile();

    provider = module.get<MockPaymentProvider>(MockPaymentProvider);
    config = module.get<ConfigService>(ConfigService);
  });

  it('should succeed for positive amount', async () => {
    const result = await provider.charge(100, 'USD');
    expect(result.succeeded).toBe(true);
    expect(result.providerPaymentId).toBeDefined();
  });

  it('should fail for non-positive amount', async () => {
    const result = await provider.charge(0, 'USD');
    expect(result.succeeded).toBe(false);
  });

  it('should fail when force fail config true', async () => {
    jest.spyOn(config, 'get').mockReturnValue('true');
    const result = await provider.charge(100, 'USD');
    expect(result.succeeded).toBe(false);
  });
});