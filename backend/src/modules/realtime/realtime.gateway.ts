import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { OnModuleInit } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';

import { RealtimeService } from './realtime.service';

@WebSocketGateway({ cors: true, namespace: '/' })
@Injectable()
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server!: Server;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    private realtimeService: RealtimeService,
  ) {}

  onModuleInit() {
    this.realtimeService.setGateway(this);
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      if (!token) throw new UnauthorizedException('No token provided');
      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = this.jwtService.verify(token, { secret });
      client.data.user = payload; // { sub, email, role }
      // join personal room
      client.join(`user:${payload.sub}`);
      // silently reject invalid connections
    } catch {
      client.disconnect();
      throw new UnauthorizedException('Invalid token');
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`WS disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinOrganization')
  async joinOrganization(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { organizationId: string },
  ) {
    const userId = client.data.user?.sub;
    if (!userId) throw new UnauthorizedException();

    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId: data.organizationId } },
    });
    if (!membership) throw new UnauthorizedException('Not a member of organization');

    const room = `organization:${data.organizationId}`;
    client.join(room);
    return { success: true, room };
  }

  @SubscribeMessage('joinEvent')
  async joinEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { eventId: string },
  ) {
    const userId = client.data.user?.sub;
    if (!userId) throw new UnauthorizedException();

    // check membership via organization of event
    const event = await this.prisma.event.findUnique({
      where: { id: data.eventId },
      select: { organizationId: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId: event.organizationId } },
    });
    // also allow if user has a ticket/reservation/order for this event
    const hasTicket = await this.prisma.ticket.findFirst({
      where: { userId, ticketType: { eventId: data.eventId } },
    });
    const hasReservation = await this.prisma.ticketReservation.findFirst({
      where: { userId, ticketType: { eventId: data.eventId } },
    });
    const hasOrder = await this.prisma.order.findFirst({
      where: { userId, items: { some: { ticketType: { eventId: data.eventId } } } },
    });

    if (!membership && !hasTicket && !hasReservation && !hasOrder) {
      throw new UnauthorizedException('No access to event');
    }

    const room = `event:${data.eventId}`;
    client.join(room);
    return { success: true, room };
  }
}