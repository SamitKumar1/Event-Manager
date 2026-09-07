import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PrismaModule } from '../../prisma/prisma.module';
import { EventsModule } from '../events/events.module';

import { TicketingController, TicketTypesGlobalController } from './ticketing.controller';
import { TicketingService } from './ticketing.service';
import { TicketTypeOrgMembershipGuard } from './guards/ticket-type-org-membership.guard';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
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
  controllers: [TicketingController, TicketTypesGlobalController],
  providers: [TicketingService, TicketTypeOrgMembershipGuard],
  exports: [TicketingService],
})
export class TicketingModule {}