import type { Request } from 'express';
import { Controller, Get, Param, Req, UseGuards, Query } from '@nestjs/common';
import { Role } from '@prisma/client';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { TicketsService } from './tickets.service';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly service: TicketsService) {}

  @Get('me')
  async findMy(@Req() req: Request & { user: { sub: string; email: string; role: Role } }, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.service.findMyTickets(req.user.sub, Number(page), Number(limit));
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request & { user: { sub: string; email: string; role: Role } }) {
    return this.service.findOne(id, req.user.sub);
  }

  @Get(':id/qr')
  async getQr(@Param('id') id: string, @Req() req: Request & { user: { sub: string; email: string; role: Role } }) {
    const ticket = await this.service.findOne(id, req.user.sub);
    // Return payload for QR generation (frontend can render QR)
    return {
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      qrToken: ticket.qrToken,
      ticketType: ticket.ticketType?.name,
    };
  }
}