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
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="text-center py-12">
            <p className="text-red-600">{error || 'Ticket not found'}</p>
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

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h1 className="text-2xl font-bold text-gray-900">Ticket Details</h1>
        </div>

        <div className="p-6 space-y-6">
          {/* Ticket Info */}
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{eventTitle}</h2>
                <p className="mt-1 text-gray-600">{ticketTypeName}</p>
              </div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  ticket.status === 'VALID'
                    ? 'bg-green-100 text-green-800'
                    : ticket.status === 'USED'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-red-100 text-red-800'
                }`}
              >
                {ticket.status}
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-gray-500">Ticket Code</label>
                <p className="mt-1 font-mono text-lg text-gray-900">{ticket.ticketCode}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Order ID</label>
                <p className="mt-1 font-mono text-sm text-gray-900">{ticket.orderId}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Purchased</label>
                <p className="mt-1 text-gray-900">{formatDate(ticket.createdAt)}</p>
              </div>
              {ticket.checkedInAt && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Checked In</label>
                  <p className="mt-1 text-gray-900">{formatDate(ticket.checkedInAt)}</p>
                </div>
              )}
            </div>
          </div>

          {/* QR Code / Token */}
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">QR Code for Check-in</h3>
            <div className="flex flex-col items-center space-y-4">
              <div className="w-64 h-64 bg-white rounded-lg flex items-center justify-center border border-gray-200 p-4">
                {(qrData?.qrToken || ticket.qrToken) ? (
  <QRCodeSVG
    value={qrData?.qrToken || ticket.qrToken}
    size={256}
    level="M"
    includeMargin={true}
  />
) : (
  <p className="text-red-600 text-sm">QR code is not available</p>
)}
                
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Present this QR code at the event for check-in</p>
                {(qrData?.qrToken || ticket.qrToken) && (
  <p className="text-xs text-gray-400 mt-1 font-mono break-all">
    {qrData?.qrToken || ticket.qrToken}
  </p>
)}
              </div>
            </div>
          </div>

          {/* Event Info */}
          {event && (
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Event Information</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Date</span>
                  <span className="text-gray-900">
                    {formatDate(event.startAt)} -{' '}
                    {new Date(event.endAt).toLocaleTimeString()}
                  </span>
                </div>
                {event.venueName && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Venue</span>
                    <span className="text-gray-900">{event.venueName}</span>
                  </div>
                )}
                {event.address && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Address</span>
                    <span className="text-gray-900">
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