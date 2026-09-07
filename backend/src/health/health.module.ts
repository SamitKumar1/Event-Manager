import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [
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
  controllers: [HealthController],
  providers: [HealthService, JwtAuthGuard, RolesGuard],
  exports: [HealthService],
})
export class HealthModule {}