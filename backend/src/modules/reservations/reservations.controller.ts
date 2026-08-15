import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ReservationsController {
  constructor(private readonly service: ReservationsService) {}

  @Post('ticket-types/:ticketTypeId/reservations')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('ticketTypeId') ticketTypeId: string,
    @Request() req: any,
    @Body() dto: CreateReservationDto,
  ) {
    return this.service.create(ticketTypeId, req.user.sub, dto);
  }

  @Get('reservations/:id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.service.findOne(id, req.user.sub);
  }

  @Get('users/me/reservations')
  async findMy(
    @Request() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.service.findMyReservations(req.user.sub, Number(page), Number(limit));
  }

  @Post('reservations/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string, @Request() req: any) {
    return this.service.cancel(id, req.user.sub);
  }
}