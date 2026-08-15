import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { organizerEventsApi, analyticsApi } from '../api/endpoints';
import { useAuth } from '../context/useAuth';
import type { Event, EventAnalytics, TicketType } from '../types/api';

function formatCurrency(amount: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(amount));
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

function formatPercent(num: number): string {
  return `${num.toFixed(2)}%`;
}

function ProgressBar({ value, max, color = 'green' }: { value: number; max: number; color?: string }) {
  const percentage = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const colors = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
  };
  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={`${colors[color as keyof typeof colors] || colors.green} h-full rounded-full transition-all duration-300`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export default function EventAnalytics() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [analytics, setAnalytics] = useState<EventAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || user?.role === 'ATTENDEE') {
      navigate('/dashboard');
      return;
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    if (!eventId || !isAuthenticated) return;

    let mounted = true;

    async function fetchData() {
      try {
        setIsLoading(true);
        const eventResponse = await organizerEventsApi.get('', eventId!);
        if (!mounted) return;
        
        const eventData = eventResponse.data;
        setEvent(eventData);
        
        const analyticsResponse = await analyticsApi.getEventAnalytics(eventId!);
        if (!mounted) return;
        
        setAnalytics(analyticsResponse.data);
        setError(null);
      } catch (err: unknown) {
        if (mounted) {
          const message = err instanceof Error ? err.message : 'Failed to load analytics';
          setError(message);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      mounted = false;
    };
  }, [eventId, isAuthenticated]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Link to="/organizer" className="text-primary-600 hover:text-primary-500">
          ← Back to Organizer Dashboard
        </Link>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
          <p className="text-red-600">{error || 'Event not found'}</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  const soldPercentage = analytics.totalTicketCapacity > 0 
    ? Math.min(100, (analytics.ticketsSold / analytics.totalTicketCapacity) * 100) 
    : 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/organizer" className="text-primary-600 hover:text-primary-500 text-sm">
            ← Back to Organizer Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{event.title} - Analytics</h1>
          <p className="text-sm text-gray-500">{formatDate(event.startAt)} - {formatDate(event.endAt)}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md flex items-center justify-between animate-fade-in">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">✕</button>
        </div>
      )}

      {/* Overview Stats - 8 Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <StatCard title="Capacity" value={formatNumber(analytics.totalTicketCapacity)} color="indigo" />
        <StatCard title="Tickets Sold" value={formatNumber(analytics.ticketsSold)} color="green" />
        <StatCard title="Remaining" value={formatNumber(analytics.ticketsRemaining)} color="yellow" />
        <StatCard title="Reservations" value={formatNumber(analytics.totalReservations)} color="blue" />
        <StatCard title="Orders" value={formatNumber(analytics.totalOrders)} color="purple" />
        <StatCard title="Revenue" value={formatCurrency(analytics.totalRevenue)} color="emerald" />
        <StatCard title="Check-ins" value={formatNumber(analytics.ticketsCheckedIn)} color="orange" />
        <StatCard title="Attendance Rate" value={formatPercent(analytics.attendanceRate)} color="rose" />
      </div>

      {/* Capacity Progress Bar */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Capacity Utilization</h3>
          <span className="text-sm font-medium text-gray-600">
            {formatNumber(analytics.ticketsSold)} / {formatNumber(analytics.totalTicketCapacity)} ({soldPercentage.toFixed(1)}%)
          </span>
        </div>
        <ProgressBar value={analytics.ticketsSold} max={analytics.totalTicketCapacity} color="green" />
        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <span>0</span>
          <span>{formatNumber(analytics.totalTicketCapacity)}</span>
        </div>
      </div>

      {/* Detailed Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <DetailCard title="Ticket Status" items={[
          { label: 'Total Capacity', value: formatNumber(analytics.totalTicketCapacity) },
          { label: 'Tickets Sold', value: formatNumber(analytics.ticketsSold) },
          { label: 'Tickets Remaining', value: formatNumber(analytics.ticketsRemaining) },
        ]} />
        <DetailCard title="Reservations" items={[
          { label: 'Total Reservations', value: formatNumber(analytics.totalReservations) },
          { label: 'Active Reservations', value: formatNumber(analytics.activeReservations) },
        ]} />
        <DetailCard title="Orders" items={[
          { label: 'Total Orders', value: formatNumber(analytics.totalOrders) },
          { label: 'Paid Orders', value: formatNumber(analytics.paidOrders) },
          { label: 'Cancelled Orders', value: formatNumber(analytics.cancelledOrders) },
        ]} />
        <DetailCard title="Check-ins" items={[
          { label: 'Tickets Checked In', value: formatNumber(analytics.ticketsCheckedIn) },
          { label: 'Attendance Rate', value: formatPercent(analytics.attendanceRate) },
        ]} />
        <DetailCard title="Revenue" items={[
          { label: 'Total Revenue', value: formatCurrency(analytics.totalRevenue) },
        ]} />
      </div>

      {/* Ticket Types Breakdown */}
      {event.ticketTypes && event.ticketTypes.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Ticket Types Breakdown</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {event.ticketTypes.map((tt) => (
              <TicketTypeAnalyticsRow key={tt.id} ticketType={tt} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, color = 'indigo' }: { title: string; value: string; color?: string }) {
  const colors = {
    indigo: 'bg-indigo-100 text-indigo-800',
    green: 'bg-green-100 text-green-800',
    blue: 'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800',
    red: 'bg-red-100 text-red-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    emerald: 'bg-emerald-100 text-emerald-800',
    orange: 'bg-orange-100 text-orange-800',
    rose: 'bg-rose-100 text-rose-800',
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
        <span className={colors[color as keyof typeof colors] || colors.indigo}>Event</span>
      </div>
    </div>
  );
}

function DetailCard({ title, items }: { title: string; items: { label: string; value: string }[] }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-sm font-medium text-gray-900 mb-4">{title}</h3>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
            <span className="text-sm text-gray-600">{item.label}</span>
            <span className="text-sm font-medium text-gray-900">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TicketTypeAnalyticsRow({ ticketType }: { ticketType: TicketType }) {
  return (
    <div className="px-6 py-4 hover:bg-gray-50">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="font-medium text-gray-900">{ticketType.name}</h3>
          <p className="text-sm text-gray-500">{ticketType.description || 'No description'}</p>
          <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
            <span>Price: <span className="font-medium text-gray-900">{formatCurrency(ticketType.price)}</span></span>
            <span>Quantity: <span className="font-medium text-gray-900">{ticketType.quantity}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}