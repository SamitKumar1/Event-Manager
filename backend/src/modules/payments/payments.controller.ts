import type { Request } from 'express';
import { Controller, Post, Get, Param, Body, Req, UseGuards, HttpStatus, Headers, BadRequestException, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

interface CreatePaymentResult {
  payment: any;
  isNew: boolean;
}

@Controller('orders/:orderId/payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post()
  async create(
    @Param('orderId') orderId: string,
    @Req() req: Request & { user: { sub: string; email: string; role: Role } },
    @Body() dto: CreatePaymentDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Res() res: Response,
  ) {
    const finalKey = idempotencyKey || dto.idempotencyKey;
    if (!finalKey) {
      throw new BadRequestException('Idempotency-Key is required');
    }
    const result = await this.service.createPayment(orderId, req.user.sub, finalKey) as CreatePaymentResult;
    res.status(result.isNew ? HttpStatus.CREATED : HttpStatus.OK).json(result.payment);
  }
}

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsGlobalController {
  constructor(private readonly service: PaymentsService) {}

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request & { user: { sub: string; email: string; role: Role } }) {
    return this.service.findOne(id, req.user.sub);
  }
}