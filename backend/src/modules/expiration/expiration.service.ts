import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExpirationService {
  private readonly logger = new Logger(ExpirationService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredReservations() {
    await this.expireReservations();
  }

  async expireReservations(): Promise<number> {
    const result = await this.prisma.ticketReservation.updateMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: new Date() },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} reservations`);
    }
    return result.count;
  }

  // Exposed for testing / manual trigger
  async expireNow(): Promise<number> {
    return this.expireReservations();
  }
}