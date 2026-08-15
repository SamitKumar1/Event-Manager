import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { validationSchema } from './config/validation.schema';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { EventsModule } from './modules/events/events.module';
import { TicketingModule } from './modules/ticketing/ticketing.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { CheckinModule } from './modules/checkin/checkin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ExpirationModule } from './modules/expiration/expiration.module';
import { EmailModule } from './modules/email/email.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      envFilePath: ['.env.local', '.env'],
    }),
    HealthModule,
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    EventsModule,
    TicketingModule,
    ReservationsModule,
    OrdersModule,
    PaymentsModule,
    TicketsModule,
    RealtimeModule,
    CheckinModule,
    NotificationsModule,
    AnalyticsModule,
    ExpirationModule,
    EmailModule,
  ],
})
export class AppModule {}