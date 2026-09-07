import type { Request } from 'express';
import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Role } from '@prisma/client';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { NotificationsService } from './notifications.service';
import { NotificationQueryDto } from './dto/notification-query.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  async findAll(
    @Req() req: Request & { user: { sub: string; email: string; role: Role } },
    @Query() query: NotificationQueryDto,
  ) {
    const { page = 1, limit = 20, unreadOnly } = query;
    return this.service.findAllForUser(req.user.sub, page, limit, unreadOnly);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: Request & { user: { sub: string; email: string; role: Role } }) {
    const count = await this.service.getUnreadCount(req.user.sub);
    return { count };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(@Req() req: Request & { user: { sub: string; email: string; role: Role } }, @Param('id') id: string) {
    return this.service.markAsRead(req.user.sub, id);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@Req() req: Request & { user: { sub: string; email: string; role: Role } }) {
    return this.service.markAllAsRead(req.user.sub);
  }
}