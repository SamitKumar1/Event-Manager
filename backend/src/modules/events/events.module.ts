import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PrismaModule } from '../../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { EmailModule } from '../email/email.module';

import { EventsController } from './events.controller';
import { EventsGlobalController } from './events-global.controller';
import { EventsService } from './events.service';
import { EventOrgMembershipGuard } from './guards/event-org-membership.guard';

@Module({
  imports: [
    PrismaModule,
    RealtimeModule,
    EmailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ?? '15m') as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [EventsController, EventsGlobalController],
  providers: [EventsService, EventOrgMembershipGuard],
  exports: [EventsService, EventOrgMembershipGuard],
})
export class EventsModule {}