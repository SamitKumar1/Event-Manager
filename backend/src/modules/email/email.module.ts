import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { MockEmailProvider } from './mock-email.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    EmailService,
    {
      provide: 'EmailProvider',
      useClass: MockEmailProvider,
    },
  ],
  exports: [EmailService],
})
export class EmailModule {}