import { apiClient } from './client';
import type {
  PaginatedResponse,
  Event,
  Reservation,
  Order,
  Payment,
  Ticket,
  CreateReservationRequest,
  CreateOrderRequest,
  QRData,
  Organization,
  TicketType,
  CreateTicketTypeRequest,
  UpdateTicketTypeRequest,
  EventAnalytics,
  OrganizationAnalytics,
} from '../types/api';

// Public events API (for attendees)
export const eventsApi = {
  list: (page = 1, limit = 20) =>
    apiClient.get<PaginatedResponse<Event>>('/events', { params: { page, limit } }),

  get: (id: string) =>
    apiClient.get<Event>(`/events/${id}`),
};

// Organizer events API
export const organizerEventsApi = {
  list: (organizationId: string, page = 1, limit = 20) =>
    apiClient.get<PaginatedResponse<Event>>(`/organizations/${organizationId}/events`, { params: { page, limit } }),

  get: (organizationId: string, id: string) =>
    apiClient.get<Event>(`/organizations/${organizationId}/events/${id}`),

  create: (organizationId: string, data: CreateEventRequest) =>
    apiClient.post<Event>(`/organizations/${organizationId}/events`, data),

  update: (organizationId: string, id: string, data: UpdateEventRequest) =>
    apiClient.patch<Event>(`/organizations/${organizationId}/events/${id}`, data),

  delete: (organizationId: string, id: string) =>
    apiClient.delete<{ message: string }>(`/organizations/${organizationId}/events/${id}`),

  publish: (organizationId: string, id: string) =>
    apiClient.post<Event>(`/organizations/${organizationId}/events/${id}/publish`),

  cancel: (organizationId: string, id: string) =>
    apiClient.post<Event>(`/organizations/${organizationId}/events/${id}/cancel`),
};

// Organizations API
export const organizationsApi = {
  list: (page = 1, limit = 10) =>
    apiClient.get<PaginatedResponse<Organization>>('/organizations', { params: { page, limit } }),

  get: (id: string) =>
    apiClient.get<Organization>(`/organizations/${id}`),

  create: (data: CreateOrganizationRequest) =>
    apiClient.post<Organization>('/organizations', data),

  update: (id: string, data: UpdateOrganizationRequest) =>
    apiClient.patch<Organization>(`/organizations/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<{ message: string }>(`/organizations/${id}`),
};

// Ticket Types API
export const ticketTypesApi = {
  list: (eventId: string, page = 1, limit = 20) =>
    apiClient.get<PaginatedResponse<TicketType>>(`/events/${eventId}/ticket-types`, { params: { page, limit } }),

  get: (id: string) =>
    apiClient.get<TicketType>(`/ticket-types/${id}`),

  create: (eventId: string, data: CreateTicketTypeRequest) =>
    apiClient.post<TicketType>(`/events/${eventId}/ticket-types`, data),

  update: (id: string, data: UpdateTicketTypeRequest) =>
    apiClient.patch<TicketType>(`/ticket-types/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<{ message: string }>(`/ticket-types/${id}`),
};

// Analytics API
export const analyticsApi = {
  getOrganizationAnalytics: (organizationId: string) =>
    apiClient.get<OrganizationAnalytics>(`/organizations/${organizationId}/analytics`),

  getEventAnalytics: (eventId: string) =>
    apiClient.get<EventAnalytics>(`/events/${eventId}/analytics`),
};

// Re-export existing APIs
export const reservationsApi = {
  create: (ticketTypeId: string, data: CreateReservationRequest) =>
    apiClient.post<Reservation>(`/ticket-types/${ticketTypeId}/reservations`, data),

  get: (id: string) =>
    apiClient.get<Reservation>(`/reservations/${id}`),

  listMine: (page = 1, limit = 20) =>
    apiClient.get<PaginatedResponse<Reservation>>('/users/me/reservations', { params: { page, limit } }),

  cancel: (id: string) =>
    apiClient.post<{ message: string }>(`/reservations/${id}/cancel`),
};

export const ordersApi = {
  create: (data: CreateOrderRequest) =>
    apiClient.post<Order>('/orders', data),

  listMine: (page = 1, limit = 20) =>
    apiClient.get<PaginatedResponse<Order>>('/orders/me', { params: { page, limit } }),

  get: (id: string) =>
    apiClient.get<Order>(`/orders/${id}`),

  cancel: (id: string) =>
    apiClient.post<{ message: string }>(`/orders/${id}/cancel`),
};

export const paymentsApi = {
  create: (orderId: string, idempotencyKey: string) =>
    apiClient.post<Payment>(
      `/orders/${orderId}/payments`,
      { idempotencyKey },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    ),

  get: (id: string) =>
    apiClient.get<Payment>(`/payments/${id}`),
};

export const ticketsApi = {
  listMine: (page = 1, limit = 20) =>
    apiClient.get<PaginatedResponse<Ticket>>('/tickets/me', { params: { page, limit } }),

  get: (id: string) =>
    apiClient.get<Ticket>(`/tickets/${id}`),

  getQr: (id: string) =>
    apiClient.get<QRData>(`/tickets/${id}/qr`),
};

// Additional types for organizer
export interface CreateEventRequest {
  title: string;
  slug: string;
  description?: string;
  locationType: 'PHYSICAL' | 'ONLINE' | 'HYBRID';
  venueName?: string;
  address?: string;
  city?: string;
  country?: string;
  startAt: string;
  endAt: string;
  timezone: string;
  coverImageUrl?: string;
}

export interface UpdateEventRequest {
  title?: string;
  slug?: string;
  description?: string;
  locationType?: 'PHYSICAL' | 'ONLINE' | 'HYBRID';
  venueName?: string;
  address?: string;
  city?: string;
  country?: string;
  startAt?: string;
  endAt?: string;
  timezone?: string;
  coverImageUrl?: string;
}

export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  website?: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  slug?: string;
  description?: string;
  logoUrl?: string;
  website?: string;
}