import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PrismaModule } from '../../prisma/prisma.module';

import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { OrgMembershipGuard } from './guards/org-membership.guard';
import { OrgRolesGuard } from './guards/org-roles.guard';

@Module({
  imports: [
    PrismaModule,
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
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrgMembershipGuard, OrgRolesGuard],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}