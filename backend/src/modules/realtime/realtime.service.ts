import { Injectable } from '@nestjs/common';

import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimeService {
  private gateway?: RealtimeGateway;

  setGateway(gateway: RealtimeGateway) {
    this.gateway = gateway;
  }

  private getServer() {
    if (!this.gateway?.server) {
      throw new Error('RealtimeGateway not initialized');
    }
    return this.gateway.server;
  }

  emitToEvent(eventId: string, eventName: string, payload: any) {
    this.getServer().to(`event:${eventId}`).emit(eventName, payload);
  }

  emitToOrganization(organizationId: string, eventName: string, payload: any) {
    this.getServer().to(`organization:${organizationId}`).emit(eventName, payload);
  }

  emitToUser(userId: string, eventName: string, payload: any) {
    this.getServer().to(`user:${userId}`).emit(eventName, payload);
  }
}