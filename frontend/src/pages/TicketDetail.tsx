import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ticketsApi } from '../api/endpoints';
import { useAuth } from '../context/useAuth';
import type { Ticket, QRData } from '../types/api';
import { QRCodeSVG } from 'qrcode.react';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !isAuthenticated) return;

    let mounted = true;

    async function fetchTicket() {
      if (!id) return;
      try {
        setIsLoading(true);
        const [ticketResponse, qrResponse] = await Promise.all([
          ticketsApi.get(id),
          ticketsApi.getQr(id),
        ]);
        if (mounted) {
          setTicket(ticketResponse.data);
          setQrData(qrResponse.data);
          setError(null);
        }
      } catch (err: unknown) {
        if (mounted) {
          const message = err instanceof Error ? err.message : 'Failed to load ticket';
          setError(message);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchTicket();

    return () => {
      mounted = false;
    };
  }, [id, isAuthenticated]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Link to="/tickets" className="text-primary-600 hover:text-primary-500">
          ← Back to Tickets
        </Link>
        <div className="bg-surface p-6 rounded-lg shadow-sm border border-border">
          <div className="text-center py-12">
            <p className="text-danger">{error || 'Ticket not found'}</p>
            <Link
              to="/tickets"
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
            >
              Back to Tickets
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const orderItem = ticket.order?.items?.[0];

const eventTitle =
  orderItem?.ticketType?.event?.title ||
  ticket.ticketType?.event?.title ||
  'Event';

const ticketTypeName = ticket.ticketType?.name || 'Ticket';

const event =
  orderItem?.ticketType?.event ||
  ticket.ticketType?.event;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Link to="/tickets" className="text-primary-600 hover:text-primary-500">
        ← Back to Tickets
      </Link>

      <div className="bg-surface rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-bg">
          <h1 className="text-2xl font-bold text-text">Ticket Details</h1>
        </div>

        <div className="p-6 space-y-6">
          {/* Ticket Info */}
          <div className="border border-border rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-text">{eventTitle}</h2>
                <p className="mt-1 text-text-muted">{ticketTypeName}</p>
              </div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  ticket.status === 'VALID'
                    ? 'bg-success-soft text-success'
                    : ticket.status === 'USED'
                      ? 'bg-info-soft text-info'
                      : 'bg-danger-soft text-danger'
                }`}
              >
                {ticket.status}
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-text-muted">Ticket Code</label>
                <p className="mt-1 font-mono text-lg text-text">{ticket.ticketCode}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-text-muted">Order ID</label>
                <p className="mt-1 font-mono text-sm text-text">{ticket.orderId}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-text-muted">Purchased</label>
                <p className="mt-1 text-text">{formatDate(ticket.createdAt)}</p>
              </div>
              {ticket.checkedInAt && (
                <div>
                  <label className="text-sm font-medium text-text-muted">Checked In</label>
                  <p className="mt-1 text-text">{formatDate(ticket.checkedInAt)}</p>
                </div>
              )}
            </div>
          </div>

          {/* QR Code / Token */}
          <div className="border border-border rounded-lg p-6">
            <h3 className="text-lg font-medium text-text mb-4">QR Code for Check-in</h3>
            <div className="flex flex-col items-center space-y-4">
              <div className="w-64 h-64 bg-surface rounded-lg flex items-center justify-center border border-border p-4">
                {(qrData?.qrToken || ticket.qrToken) ? (
  <QRCodeSVG
    value={qrData?.qrToken || ticket.qrToken}
    size={256}
    level="M"
    includeMargin={true}
  />
) : (
  <p className="text-danger text-sm">QR code is not available</p>
)}
                
              </div>
              <div className="text-center">
                <p className="text-sm text-text-muted">Present this QR code at the event for check-in</p>
                {(qrData?.qrToken || ticket.qrToken) && (
  <p className="text-xs text-text-subtle mt-1 font-mono break-all">
    {qrData?.qrToken || ticket.qrToken}
  </p>
)}
              </div>
            </div>
          </div>

          {/* Event Info */}
          {event && (
            <div className="border border-border rounded-lg p-6">
              <h3 className="text-lg font-medium text-text mb-4">Event Information</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-text-muted">Date</span>
                  <span className="text-text">
                    {formatDate(event.startAt)} -{' '}
                    {new Date(event.endAt).toLocaleTimeString()}
                  </span>
                </div>
                {event.venueName && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Venue</span>
                    <span className="text-text">{event.venueName}</span>
                  </div>
                )}
                {event.address && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Address</span>
                    <span className="text-text">
                      {event.address}
                      {event.city && `, ${event.city}`}
                      {event.country && `, ${event.country}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}