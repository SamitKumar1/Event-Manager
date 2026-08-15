export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  createdAt: string;
  updatedAt: string;
  members?: OrganizationMember[];
}

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Event {
  id: string;
  organizationId: string;
  createdById: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  locationType: string;
  venueName: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  startAt: string;
  endAt: string;
  timezone: string;
  coverImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  ticketTypes: TicketType[];
}

export interface TicketType {
  id: string;
  eventId: string;
  name: string;
  description: string | null;
  price: string;
  quantity: number;
  salesStartAt: string;
  salesEndAt: string;
  createdAt: string;
  updatedAt: string;
  event?: Event;
}

export interface Reservation {
  id: string;
  ticketTypeId: string;
  userId: string;
  quantity: number;
  status: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  ticketType?: TicketType & { event?: Event };
}

export interface OrderItem {
  id: string;
  orderId: string;
  ticketTypeId: string;
  quantity: number;
  unitPrice: string;
  createdAt: string;
  ticketType?: TicketType;
}

export interface Order {
  id: string;
  userId: string;
  status: string;
  totalAmount: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface Payment {
  id: string;
  orderId: string;
  status: string;
  amount: string;
  currency: string;
  provider: string;
  providerPaymentId: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  order?: Order;
}

export interface Ticket {
  id: string;
  orderId: string;
  orderItemId: string;
  ticketTypeId: string;
  userId: string;
  ticketCode: string;
  qrToken: string;
  status: string;
  checkedInAt: string | null;
  createdAt: string;
  updatedAt: string;
  ticketType?: TicketType;
  order?: Order;
}

export interface CreateReservationRequest {
  quantity: number;
}

export interface CreateTicketTypeRequest {
  name: string;
  description?: string;
  price: number;
  quantity: number;
  salesStartAt: string;
  salesEndAt: string;
}

export interface UpdateTicketTypeRequest {
  name?: string;
  description?: string;
  price?: number;
  quantity?: number;
  salesStartAt?: string;
  salesEndAt?: string;
}

export interface CreateOrderRequest {
  items: CreateOrderItemRequest[];
}

export interface CreateOrderItemRequest {
  ticketTypeId: string;
  quantity: number;
}

export interface CreatePaymentRequest {
  idempotencyKey?: string;
}

export interface QRData {
  ticketId: string;
  ticketCode: string;
  qrToken: string;
  ticketType: string | null;
}

export interface EventAnalytics {
  eventId: string;
  totalTicketCapacity: number;
  ticketsSold: number;
  ticketsRemaining: number;
  totalReservations: number;
  activeReservations: number;
  totalOrders: number;
  paidOrders: number;
  cancelledOrders: number;
  totalRevenue: string;
  ticketsCheckedIn: number;
  attendanceRate: number;
}

export interface OrganizationAnalytics {
  organizationId: string;
  totalEvents: number;
  publishedEvents: number;
  totalCapacity: number;
  ticketsSold: number;
  totalOrders: number;
  paidOrders: number;
  totalRevenue: string;
  ticketsCheckedIn: number;
}