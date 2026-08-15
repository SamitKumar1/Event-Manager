import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { eventsApi, reservationsApi } from '../api/endpoints';
import { useAuth } from '../context/useAuth';
import type { Event, TicketType, Reservation } from '../types/api';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPrice(price: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(price));
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reservingTicketTypeId, setReservingTicketTypeId] = useState<string | null>(null);
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [reservationSuccess, setReservationSuccess] = useState<Reservation | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!id) return;

    let mounted = true;

    async function fetchEvent() {
      if (!id) return;
      try {
        setIsLoading(true);
        const response = await eventsApi.get(id);
        if (mounted) {
          setEvent(response.data);
          setError(null);
        }
      } catch (err: unknown) {
        if (mounted) {
          const message = err instanceof Error ? err.message : 'Failed to load event';
          setError(message);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchEvent();

    return () => {
      mounted = false;
    };
  }, [id]);

  const publishedTicketTypes = event?.ticketTypes.filter(
    (tt) => new Date(tt.salesStartAt) <= new Date() && new Date(tt.salesEndAt) >= new Date()
  ) ?? [];

  const handleQuantityChange = (ticketTypeId: string, quantity: number) => {
    setQuantities((prev) => ({ ...prev, [ticketTypeId]: quantity }));
  };

  const handleReserve = async (ticketType: TicketType) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const quantity = quantities[ticketType.id] || 1;
    if (quantity < 1) return;

    setReservingTicketTypeId(ticketType.id);
    setReservationError(null);
    setReservationSuccess(null);

    try {
      const response = await reservationsApi.create(ticketType.id, { quantity });
      setReservationSuccess(response.data);
      setQuantities((prev) => ({ ...prev, [ticketType.id]: 1 }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Reservation failed';
      setReservationError(message);
    } finally {
      setReservingTicketTypeId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/events" className="text-primary-600 hover:text-primary-500">
            ← Back to Events
          </Link>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="text-center py-12">
            <p className="text-red-600">{error || 'Event not found'}</p>
            <Link
              to="/events"
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
            >
              Back to Events
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/events" className="text-primary-600 hover:text-primary-500">
          ← Back to Events
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {event.coverImageUrl && (
          <img
            src={event.coverImageUrl}
            alt={event.title}
            className="w-full h-64 object-cover"
          />
        )}
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{event.title}</h1>
              <p className="mt-2 text-gray-600">{event.description || 'No description available'}</p>
            </div>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                event.status === 'PUBLISHED'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {event.status}
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Date & Time</h3>
              <p className="mt-1 text-gray-900">{formatDate(event.startAt)} - {formatDate(event.endAt)}</p>
              <p className="text-sm text-gray-500">{event.timezone}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Location</h3>
              {event.locationType === 'ONLINE' ? (
                <p className="mt-1 text-gray-900">Online Event</p>
              ) : (
                <>
                  <p className="mt-1 text-gray-900">{event.venueName}</p>
                  <p className="text-gray-900">
                    {event.address}
                    {event.city && `, ${event.city}`}
                    {event.country && `, ${event.country}`}
                  </p>
                </>
              )}
            </div>
          </div>

          {publishedTicketTypes.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xl font-bold text-gray-900">Available Tickets</h2>
              <div className="mt-4 space-y-4">
                {publishedTicketTypes.map((tt) => (
                  <TicketTypeReservation
                    key={tt.id}
                    ticketType={tt}
                    quantity={quantities[tt.id] || 1}
                    onQuantityChange={handleQuantityChange}
                    onReserve={handleReserve}
                    isReserving={reservingTicketTypeId === tt.id}
                    reservationError={reservationError}
                    reservationSuccess={reservationSuccess}
                    clearMessages={() => {
                      setReservationError(null);
                      setReservationSuccess(null);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TicketTypeReservation({
  ticketType,
  quantity,
  onQuantityChange,
  onReserve,
  isReserving,
  reservationError,
  reservationSuccess,
  clearMessages,
}: {
  ticketType: TicketType;
  quantity: number;
  onQuantityChange: (id: string, qty: number) => void;
  onReserve: (tt: TicketType) => void;
  isReserving: boolean;
  reservationError: string | null;
  reservationSuccess: Reservation | null;
  clearMessages: () => void;
}) {
  const available = ticketType.quantity;

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">{ticketType.name}</h3>
          {ticketType.description && <p className="mt-1 text-sm text-gray-500">{ticketType.description}</p>}
          <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
            <span>Price: <span className="font-medium text-gray-900">{formatPrice(ticketType.price)}</span></span>
            <span>Available: <span className={available > 0 ? 'text-green-600' : 'text-red-600'} font-medium>{available}</span></span>
            <span>Sales: {new Date(ticketType.salesStartAt).toLocaleDateString()} - {new Date(ticketType.salesEndAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center border border-gray-300 rounded-md">
            <button
              onClick={() => onQuantityChange(ticketType.id, Math.max(1, quantity - 1))}
              disabled={quantity <= 1 || isReserving}
              className="px-3 py-1.5 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              −
            </button>
            <span className="px-4 text-center w-12">{quantity}</span>
            <button
              onClick={() => onQuantityChange(ticketType.id, quantity + 1)}
              disabled={quantity >= available || isReserving}
              className="px-3 py-1.5 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
          <button
            onClick={() => onReserve(ticketType)}
            disabled={isReserving || quantity > available || available === 0}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isReserving ? 'Reserving...' : 'Reserve'}
          </button>
        </div>
      </div>

      {(reservationError || reservationSuccess) && (
        <div className="mt-4 p-3 rounded-md animate-fade-in">
          {reservationError && (
            <div className="bg-red-50 text-red-600 flex items-center justify-between">
              <span>{reservationError}</span>
              <button onClick={clearMessages} className="text-red-600 hover:text-red-800">
                ✕
              </button>
            </div>
          )}
          {reservationSuccess && (
            <div className="bg-green-50 text-green-600 flex items-center justify-between">
              <span>
                ✓ Reservation created! Expires at {new Date(reservationSuccess.expiresAt).toLocaleTimeString()}
                <button
                  onClick={() => window.location.href = `/checkout?reservation=${reservationSuccess.id}`}
                  className="ml-3 text-sm underline hover:text-green-800"
                >
                  Proceed to Checkout
                </button>
              </span>
              <button onClick={clearMessages} className="text-green-600 hover:text-green-800">
                ✕
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}