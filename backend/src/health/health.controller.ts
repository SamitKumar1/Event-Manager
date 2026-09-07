import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check() {
    return this.healthService.check();
  }

  @UseGuards(JwtAuthGuard)
  @Get('protected')
  protected(@Req() req: Request & { user: { sub: string; email: string; role: Role } }) {
    const user = req.user;
    return {
      message: 'Authenticated',
      user: {
        id: user.sub,
        email: user.email,
        role: user.role,
      },
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin')
  admin(@Req() req: Request & { user: { sub: string; email: string; role: Role } }) {
    const user = req.user;
    return {
      message: 'Admin access granted',
      user: {
        id: user.sub,
        email: user.email,
        role: user.role,
      },
    };
  }
}