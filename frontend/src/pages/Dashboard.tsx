import { useAuth } from '../context/useAuth';
import { PageHeader, StatTile, Card, Button } from '../components/ui';

const CalendarIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
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

const TicketIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <path d="M13 5v2M13 17v2M13 11v2" />
  </svg>
);

const StarIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export default function Dashboard() {
  const { user } = useAuth();
  const isOrganizer = user?.role === 'ORGANIZER' || user?.role === 'ADMIN';

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome, ${user?.name}`}
        subtitle="Welcome to your dashboard"
        actions={
          isOrganizer ? (
            <Button as="a" to="/organizer">
              Organizer Console
            </Button>
          ) : (
            <Button as="a" to="/events">
              Browse Events
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatTile
          label="My Events"
          value={0}
          tone="primary"
          icon={<CalendarIcon />}
          caption="Events you've created"
        />
        <StatTile
          label="My Tickets"
          value={0}
          tone="info"
          icon={<TicketIcon />}
          caption="Tickets purchased"
        />
        <StatTile
          label="Upcoming Events"
          value={0}
          tone="success"
          icon={<StarIcon />}
          caption="Events you're attending"
        />
      </div>

      <Card>
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-medium text-text">Quick Actions</h2>
        </div>
        <div className="p-6 flex flex-wrap gap-3">
          <Button as="a" to="/events" variant="secondary">
            Browse Events
          </Button>
          {isOrganizer ? (
            <Button as="a" to="/organizer">
              Open Organizer Console
            </Button>
          ) : (
            <Button as="a" to="/tickets" variant="secondary">
              View My Tickets
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
