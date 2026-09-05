import { useEffect, useState } from 'react';
import { eventsApi } from '../api/endpoints';
import { useAuth } from '../context/useAuth';
import { PageHeader, Card, Button, StatusPill, EmptyState, Spinner } from '../components/ui';
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

const CalendarIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const GlobeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

export default function Events() {
  const { isAuthenticated } = useAuth();
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
        <PageHeader title="Events" subtitle="Browse and discover events" />
        <Card>
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
            <span className="sr-only">Loading events...</span>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Events" subtitle="Browse and discover events" />
        <Card>
          <EmptyState
            title="Couldn't load events"
            description={error}
            action={
              <Button onClick={() => window.location.reload()}>Retry</Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        subtitle="Browse and discover events"
        actions={
          isAuthenticated ? (
            <Button as="a" to="/organizer" variant="secondary">
              Create Event
            </Button>
          ) : undefined
        }
      />

      {events.length === 0 ? (
        <Card>
          <EmptyState
            title="No events available yet"
            description="Check back later for new events."
          />
        </Card>
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
    <Card className="overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      {event.coverImageUrl ? (
        <img
          src={event.coverImageUrl}
          alt={event.title}
          className="w-full h-48 object-cover"
        />
      ) : (
        <div className="w-full h-48 bg-surface-2 flex items-center justify-center text-text-subtle">
          <CalendarIcon />
        </div>
      )}
      <Card.Body className="flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-text">{event.title}</h3>
            <p className="mt-1 text-sm text-text-muted">
              {event.venueName}
              {event.city && `, ${event.city}`}
              {event.country && `, ${event.country}`}
            </p>
          </div>
          <StatusPill kind="event" value={event.status} size="sm" />
        </div>

        <div className="mt-4 space-y-1">
          <div className="flex items-center text-sm text-text-muted">
            <span className="mr-1.5 text-text-subtle">
              <CalendarIcon />
            </span>
            {formatDate(event.startAt)} – {formatDate(event.endAt)}
          </div>
          {event.locationType === 'ONLINE' && (
            <div className="flex items-center text-sm text-text-muted">
              <span className="mr-1.5 text-text-subtle">
                <GlobeIcon />
              </span>
              Online Event
            </div>
          )}
        </div>

        {publishedTicketTypes.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <h4 className="text-sm font-medium text-text">Ticket Types</h4>
            <div className="mt-2 space-y-2">
              {publishedTicketTypes.map((tt) => (
                <TicketTypeRow key={tt.id} ticketType={tt} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto pt-4">
          <Button as="a" to={`/events/${event.id}`} variant="secondary" fullWidth>
            View Details &amp; Reserve
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}

function TicketTypeRow({ ticketType }: { ticketType: TicketType }) {
  const available = ticketType.quantity;
  const isAvailable = available > 0;

  return (
    <div className="flex items-center justify-between p-3 bg-bg rounded-md">
      <div>
        <p className="text-sm font-medium text-text">{ticketType.name}</p>
        {ticketType.description && (
          <p className="text-xs text-text-muted truncate max-w-xs">{ticketType.description}</p>
        )}
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-sm font-semibold text-text">{formatPrice(ticketType.price)}</span>
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            isAvailable ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
          }`}
        >
          {isAvailable ? `${available} left` : 'Sold out'}
        </span>
      </div>
    </div>
  );
}
