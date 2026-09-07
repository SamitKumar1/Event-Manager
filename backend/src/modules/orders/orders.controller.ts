import type { Request } from 'express';
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Role } from '@prisma/client';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: Request & { user: { sub: string; email: string; role: Role } }, @Body() dto: CreateOrderDto) {
    return this.service.create(req.user.sub, dto);
  }

  @Get('me')
  async findMy(@Req() req: Request & { user: { sub: string; email: string; role: Role } }, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.service.findMyOrders(req.user.sub, Number(page), Number(limit));
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request & { user: { sub: string; email: string; role: Role } }) {
    return this.service.findOne(id, req.user.sub);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string, @Req() req: Request & { user: { sub: string; email: string; role: Role } }) {
    return this.service.cancel(id, req.user.sub);
  }
}