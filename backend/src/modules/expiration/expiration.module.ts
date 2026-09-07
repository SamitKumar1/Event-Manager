import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { ExpirationService } from './expiration.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [ExpirationService],
  exports: [ExpirationService],
})
export class ExpirationModule {}