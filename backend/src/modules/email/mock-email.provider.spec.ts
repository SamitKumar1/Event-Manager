import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { MockEmailProvider } from './mock-email.provider';

describe('MockEmailProvider', () => {
  let provider: MockEmailProvider;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MockEmailProvider,
        { provide: ConfigService, useValue: { get: jest.fn((key: string) => key === 'MOCK_EMAIL_FORCE_FAIL' ? 'false' : undefined) } },
      ],
    }).compile();

    provider = module.get<MockEmailProvider>(MockEmailProvider);
    configService = module.get(ConfigService);
    provider.clear();
  });

  it('should record sent emails', async () => {
    await provider.sendEmail({ to: 'test@example.com', subject: 'Test', html: '<p>Hello</p>' });
    expect(provider.sentEmails).toHaveLength(1);
    expect(provider.sentEmails[0]).toMatchObject({ to: 'test@example.com', subject: 'Test' });
  });

  it('should fail when MOCK_EMAIL_FORCE_FAIL is true', async () => {
    jest.spyOn(configService, 'get').mockReturnValue('true');
    await expect(provider.sendEmail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' })).rejects.toThrow('Mock email provider forced failure');
  });

  it('should clear sent emails', () => {
    provider.sentEmails.push({ to: 'a', subject: 's', html: 'h' });
    provider.clear();
    expect(provider.sentEmails).toHaveLength(0);
  });
});