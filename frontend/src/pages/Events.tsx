import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventsApi } from '../api/endpoints';
import type { Event, TicketType } from '../types/api';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
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

function getAvailableQuantity(ticketType: TicketType): number {
  return ticketType.quantity;
}

export default function Events() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchEvents() {
      try {
        setIsLoading(true);
        const response = await eventsApi.list(1, 20);
        if (mounted) {
          setEvents(response.data.items);
          setError(null);
        }
      } catch (err: unknown) {
        if (mounted) {
          const message = err instanceof Error ? err.message : 'Failed to load events';
          setError(message);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchEvents();

    return () => {
      mounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Events</h1>
          <p className="mt-1 text-gray-600">Browse and discover events</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" />
            <span className="sr-only">Loading events...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Events</h1>
          <p className="mt-1 text-gray-600">Browse and discover events</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="text-center py-12">
            <p className="text-red-600">Failed to load events: {error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Events</h1>
        <p className="mt-1 text-gray-600">Browse and discover events</p>
      </div>

      {events.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="text-center py-12">
            <p className="text-gray-500">No events available yet</p>
            <p className="text-sm text-gray-400 mt-1">Check back later for new events</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventCard({ event }: { event: Event }) {
  const publishedTicketTypes = event.ticketTypes.filter(
    (tt) => new Date(tt.salesStartAt) <= new Date() && new Date(tt.salesEndAt) >= new Date()
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {event.coverImageUrl && (
        <img
          src={event.coverImageUrl}
          alt={event.title}
          className="w-full h-48 object-cover"
        />
      )}
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{event.title}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {event.venueName}
              {event.city && `, ${event.city}`}
              {event.country && `, ${event.country}`}
            </p>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              event.status === 'PUBLISHED'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {event.status}
          </span>
        </div>

        <div className="mt-4">
          <div className="flex items-center text-sm text-gray-500">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatDate(event.startAt)} - {formatDate(event.endAt)}
          </div>
          {event.locationType === 'ONLINE' && (
            <div className="mt-1 flex items-center text-sm text-gray-500">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
              Online Event
            </div>
          )}
        </div>

        {publishedTicketTypes.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <h4 className="text-sm font-medium text-gray-900">Ticket Types</h4>
            <div className="mt-2 space-y-2">
              {publishedTicketTypes.map((tt) => (
                <TicketTypeRow key={tt.id} ticketType={tt} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100">
          <Link
            to={`/events/${event.id}`}
            className="block w-full text-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            View Details & Reserve
          </Link>
        </div>
      </div>
    </div>
  );
}

function TicketTypeRow({ ticketType }: { ticketType: TicketType }) {
  const available = getAvailableQuantity(ticketType);

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
      <div>
        <p className="text-sm font-medium text-gray-900">{ticketType.name}</p>
        {ticketType.description && (
          <p className="text-xs text-gray-500 truncate max-w-xs">{ticketType.description}</p>
        )}
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-sm font-semibold text-gray-900">{formatPrice(ticketType.price)}</span>
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            available > 0
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {available > 0 ? `${available} left` : 'Sold out'}
        </span>
      </div>
    </div>
  );
}