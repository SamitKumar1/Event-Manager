import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { organizationsApi, organizerEventsApi, analyticsApi } from '../api/endpoints';
import type { CreateEventRequest, UpdateEventRequest } from '../api/endpoints';
import { useAuth } from '../context/useAuth';
import type { Organization, Event, OrganizationAnalytics } from '../types/api';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(amount: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(amount));
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'PUBLISHED':
      return 'bg-green-100 text-green-800';
    case 'DRAFT':
      return 'bg-gray-100 text-gray-800';
    case 'CANCELLED':
      return 'bg-red-100 text-red-800';
    case 'COMPLETED':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export default function OrganizerDashboard() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [analytics, setAnalytics] = useState<OrganizationAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  // Check if user is organizer/admin
  useEffect(() => {
    if (isAuthenticated && user?.role === 'ATTENDEE') {
      navigate('/dashboard');
    }
  }, [isAuthenticated, user, navigate]);

  // Load organizations
  useEffect(() => {
    if (!isAuthenticated) return;

    let mounted = true;

    async function fetchOrganizations() {
      try {
        setIsLoading(true);
        const response = await organizationsApi.list();
        if (mounted) {
          setOrganizations(response.data.items);
          // Auto-select first organization if available
          if (response.data.items.length > 0 && !selectedOrgId) {
            setSelectedOrgId(response.data.items[0].id);
          }
          setError(null);
        }
      } catch (err: unknown) {
        if (mounted) {
          const message = err instanceof Error ? err.message : 'Failed to load organizations';
          setError(message);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchOrganizations();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  // Load events and analytics when organization is selected
  useEffect(() => {
    if (!selectedOrgId || !isAuthenticated) return;

    let mounted = true;

    async function fetchData() {
      if (!selectedOrgId) return;
      try {
        setIsLoading(true);
        const [eventsResponse, analyticsResponse] = await Promise.all([
          organizerEventsApi.list(selectedOrgId),
          analyticsApi.getOrganizationAnalytics(selectedOrgId),
        ]);
        if (mounted) {
          setEvents(eventsResponse.data.items);
          setAnalytics(analyticsResponse.data);
          setError(null);
        }
      } catch (err: unknown) {
        if (mounted) {
          const message = err instanceof Error ? err.message : 'Failed to load data';
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
  }, [selectedOrgId, isAuthenticated]);

  const handleCreateOrganization = async (data: { name: string; slug: string; description?: string }) => {
    try {
      await organizationsApi.create(data);
      setShowCreateOrgModal(false);
      // Refresh organizations
      const response = await organizationsApi.list();
      setOrganizations(response.data.items);
      if (response.data.items.length > 0) {
        setSelectedOrgId(response.data.items[0].id);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create organization';
      setError(message);
    }
  };

  const handleCreateEvent = async (data: {
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
  }) => {
    if (!selectedOrgId) return;

    try {
      await organizerEventsApi.create(selectedOrgId, data);
      setShowCreateEventModal(false);
      // Refresh events
      const response = await organizerEventsApi.list(selectedOrgId);
      setEvents(response.data.items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create event';
      setError(message);
    }
  };

  const handlePublishEvent = async (eventId: string) => {
    if (!selectedOrgId) return;

    try {
      await organizerEventsApi.publish(selectedOrgId, eventId);
      const response = await organizerEventsApi.list(selectedOrgId);
      setEvents(response.data.items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to publish event';
      setError(message);
    }
  };

  const handleCancelEvent = async (eventId: string) => {
    if (!selectedOrgId) return;

    try {
      await organizerEventsApi.cancel(selectedOrgId, eventId);
      const response = await organizerEventsApi.list(selectedOrgId);
      setEvents(response.data.items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to cancel event';
      setError(message);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!selectedOrgId || !window.confirm('Are you sure you want to delete this event?')) return;

    try {
      await organizerEventsApi.delete(selectedOrgId, eventId);
      const response = await organizerEventsApi.list(selectedOrgId);
      setEvents(response.data.items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete event';
      setError(message);
    }
  };

  const handleUpdateEvent = async (data: UpdateEventRequest) => {
    if (!selectedOrgId || !editingEvent) return;

    try {
      await organizerEventsApi.update(selectedOrgId, editingEvent.id, data);
      setEditingEvent(null);
      const response = await organizerEventsApi.list(selectedOrgId);
      setEvents(response.data.items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update event';
      setError(message);
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

  if (!isAuthenticated || user?.role === 'ATTENDEE') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Organizer Access Required</h1>
          <p className="text-gray-600">You need organizer or admin role to access this page.</p>
          <Link
            to="/dashboard"
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const selectedOrg = organizations.find((o) => o.id === selectedOrgId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Organizer Dashboard</h1>
          <p className="mt-1 text-gray-600">Manage your organizations and events</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedOrgId || ''}
            onChange={(e) => setSelectedOrgId(e.target.value || null)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Select Organization</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowCreateOrgModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            + New Organization
          </button>
          {selectedOrgId && (
            <button
              onClick={() => setShowCreateEventModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
            >
              + Create Event
            </button>
          )}
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md flex items-center justify-between animate-fade-in">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            ✕
          </button>
        </div>
      )}

      {/* Organization Analytics */}
      {selectedOrg && analytics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Events" value={analytics.totalEvents} />
          <StatCard title="Published" value={analytics.publishedEvents} color="green" />
          <StatCard title="Tickets Sold" value={analytics.ticketsSold} color="blue" />
          <StatCard title="Revenue" value={formatCurrency(analytics.totalRevenue)} color="purple" />
        </div>
      )}

      {/* Events List */}
      {selectedOrg && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Events</h2>
            <span className="text-sm text-gray-500">{events.length} events</span>
          </div>
          {events.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500 mb-4">No events yet</p>
              <button
                onClick={() => setShowCreateEventModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
              >
                Create Your First Event
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {events.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  onPublish={handlePublishEvent}
                  onCancel={handleCancelEvent}
                  onDelete={handleDeleteEvent}
                  onEdit={setEditingEvent}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {!selectedOrg && organizations.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
          <p className="text-gray-500">Select an organization to view events</p>
        </div>
      )}

      {!selectedOrg && organizations.length === 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
          <p className="text-gray-500 mb-4">No organizations yet</p>
          <button
            onClick={() => setShowCreateOrgModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Create Organization
          </button>
        </div>
      )}

      {/* Create Organization Modal */}
      {showCreateOrgModal && (
        <CreateOrgModal onClose={() => setShowCreateOrgModal(false)} onSubmit={handleCreateOrganization} />
      )}

      {/* Create Event Modal */}
      {showCreateEventModal && selectedOrgId && (
        <CreateEventModal onClose={() => setShowCreateEventModal(false)} onSubmit={handleCreateEvent} />
      )}

      {/* Edit Event Modal */}
      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSubmit={handleUpdateEvent}
        />
      )}
    </div>
  );
}

function StatCard({ title, value, color = 'indigo' }: { title: string; value: string | number; color?: string }) {
  const colors = {
    indigo: 'bg-indigo-100 text-indigo-800',
    green: 'bg-green-100 text-green-800',
    blue: 'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800',
    red: 'bg-red-100 text-red-800',
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
        <span className={colors[color as keyof typeof colors] || colors.indigo}>Organization</span>
      </div>
    </div>
  );
}

function EventRow({
  event,
  onPublish,
  onCancel,
  onDelete,
  onEdit,
}: {
  event: Event;
  onPublish: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (event: Event) => void;
}) {
  const ticketTypesCount = event.ticketTypes?.length || 0;
  const totalCapacity = event.ticketTypes?.reduce((sum, tt) => sum + tt.quantity, 0) || 0;

  return (
    <div className="px-6 py-4 hover:bg-gray-50">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{event.title}</h3>
            <p className="text-sm text-gray-500">
              {formatDate(event.startAt)} • {ticketTypesCount} ticket types • {totalCapacity} capacity
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(event.status)}`}>
            {event.status}
          </span>
          {event.status === 'DRAFT' && (
            <>
              <button
                onClick={() => onPublish(event.id)}
                className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
              >
                Publish
              </button>
              <button
                onClick={() => onDelete(event.id)}
                className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-md"
              >
                Delete
              </button>
            </>
          )}
          {event.status === 'PUBLISHED' && (
            <button
              onClick={() => onCancel(event.id)}
              className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-md"
            >
              Cancel
            </button>
          )}
          <Link
            to={`/organizer/events/${event.id}/tickets`}
            className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            Tickets
          </Link>
          <Link
            to={`/organizer/events/${event.id}/analytics`}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-700"
          >
            Analytics
          </Link>
          <button
            onClick={() => onEdit(event)}
            className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateOrgModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: { name: string; slug: string; description?: string }) => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await onSubmit({ name, slug, description });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Create Organization</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL-friendly)</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                required
                pattern="^[a-z0-9-]+$"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={isLoading} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md disabled:opacity-50">
                {isLoading ? 'Creating...' : 'Create Organization'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function CreateEventModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: CreateEventRequest) => void }) {
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    locationType: 'PHYSICAL' as 'PHYSICAL' | 'ONLINE' | 'HYBRID',
    venueName: '',
    address: '',
    city: '',
    country: '',
    startAt: '',
    endAt: '',
    timezone: 'UTC',
    coverImageUrl: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await onSubmit(formData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Create Event</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => handleChange('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  required
                  pattern="^[a-z0-9-]+$"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location Type</label>
              <select
                value={formData.locationType}
                onChange={(e) => handleChange('locationType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="PHYSICAL">Physical</option>
                <option value="ONLINE">Online</option>
                <option value="HYBRID">Hybrid</option>
              </select>
            </div>
            {(formData.locationType === 'PHYSICAL' || formData.locationType === 'HYBRID') && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venue Name</label>
                  <input
                    type="text"
                    value={formData.venueName}
                    onChange={(e) => handleChange('venueName', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => handleChange('country', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            )}
            {formData.locationType === 'ONLINE' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Venue Name (Platform)</label>
                <input
                  type="text"
                  value={formData.venueName}
                  onChange={(e) => handleChange('venueName', e.target.value)}
                  required
                  placeholder="e.g., Zoom, YouTube Live"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date & Time</label>
                <input
                  type="datetime-local"
                  value={formData.startAt}
                  onChange={(e) => handleChange('startAt', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date & Time</label>
                <input
                  type="datetime-local"
                  value={formData.endAt}
                  onChange={(e) => handleChange('endAt', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <input
                type="text"
                value={formData.timezone}
                onChange={(e) => handleChange('timezone', e.target.value)}
                required
                placeholder="e.g., UTC, America/New_York"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image URL (optional)</label>
              <input
                type="url"
                value={formData.coverImageUrl}
                onChange={(e) => handleChange('coverImageUrl', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={isLoading} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md disabled:opacity-50">
                {isLoading ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function EditEventModal({
  event,
  onClose,
  onSubmit,
}: {
  event: Event;
  onClose: () => void;
  onSubmit: (data: UpdateEventRequest) => void;
}) {
  const [formData, setFormData] = useState({
    title: event.title,
    slug: event.slug,
    description: event.description || '',
    locationType: event.locationType as 'PHYSICAL' | 'ONLINE' | 'HYBRID',
    venueName: event.venueName || '',
    address: event.address || '',
    city: event.city || '',
    country: event.country || '',
    startAt: event.startAt.slice(0, 16),
    endAt: event.endAt.slice(0, 16),
    timezone: event.timezone,
    coverImageUrl: event.coverImageUrl || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await onSubmit(formData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update event');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Event</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => handleChange('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  required
                  pattern="^[a-z0-9-]+$"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location Type</label>
              <select
                value={formData.locationType}
                onChange={(e) => handleChange('locationType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="PHYSICAL">Physical</option>
                <option value="ONLINE">Online</option>
                <option value="HYBRID">Hybrid</option>
              </select>
            </div>
            {(formData.locationType === 'PHYSICAL' || formData.locationType === 'HYBRID') && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venue Name</label>
                  <input
                    type="text"
                    value={formData.venueName}
                    onChange={(e) => handleChange('venueName', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => handleChange('country', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            )}
            {formData.locationType === 'ONLINE' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Venue Name (Platform)</label>
                <input
                  type="text"
                  value={formData.venueName}
                  onChange={(e) => handleChange('venueName', e.target.value)}
                  required
                  placeholder="e.g., Zoom, YouTube Live"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date & Time</label>
                <input
                  type="datetime-local"
                  value={formData.startAt}
                  onChange={(e) => handleChange('startAt', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date & Time</label>
                <input
                  type="datetime-local"
                  value={formData.endAt}
                  onChange={(e) => handleChange('endAt', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <input
                type="text"
                value={formData.timezone}
                onChange={(e) => handleChange('timezone', e.target.value)}
                required
                placeholder="e.g., UTC, America/New_York"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image URL (optional)</label>
              <input
                type="url"
                value={formData.coverImageUrl}
                onChange={(e) => handleChange('coverImageUrl', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={isLoading} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md disabled:opacity-50">
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}