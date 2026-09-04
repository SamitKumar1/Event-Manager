import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { organizerEventsApi, ticketTypesApi } from '../api/endpoints';
import { useAuth } from '../context/useAuth';
import type { Event, TicketType, CreateTicketTypeRequest, UpdateTicketTypeRequest } from '../types/api';

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
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EventTicketTypes() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTicketType, setEditingTicketType] = useState<TicketType | null>(null);

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
        if (mounted) {
          setEvent(eventResponse.data);
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

    fetchData();

    return () => {
      mounted = false;
    };
  }, [eventId, isAuthenticated]);

useEffect(() => {
    if (!eventId) return;

    const mounted = { current: true };

    async function fetchTicketTypes() {
      try {
        const response = await ticketTypesApi.list(eventId!);
        if (mounted.current) {
          setTicketTypes(response.data.items);
        }
      } catch (err: unknown) {
        if (mounted.current) {
          console.error('Failed to load ticket types', err);
        }
      }
    }

    fetchTicketTypes();

    return () => {
      mounted.current = false;
    };
  }, [eventId]);

  const handleCreateTicketType = async (data: {
    name: string;
    description?: string;
    price: number;
    quantity: number;
    salesStartAt: string;
    salesEndAt: string;
  }) => {
    if (!eventId) return;

    try {
      await ticketTypesApi.create(eventId, data);
      setShowCreateModal(false);
      const response = await ticketTypesApi.list(eventId);
      setTicketTypes(response.data.items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create ticket type';
      setError(message);
    }
  };

  const handleUpdateTicketType = async (data: {
    name?: string;
    description?: string;
    price?: number;
    quantity?: number;
    salesStartAt?: string;
    salesEndAt?: string;
  }) => {
    if (!editingTicketType) return;

    try {
      await ticketTypesApi.update(editingTicketType.id, data);
      setEditingTicketType(null);
      const response = await ticketTypesApi.list(eventId!);
      setTicketTypes(response.data.items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update ticket type';
      setError(message);
    }
  };

  const handleDeleteTicketType = async (ticketTypeId: string) => {
    if (!window.confirm('Are you sure you want to delete this ticket type?')) return;

    try {
      await ticketTypesApi.delete(ticketTypeId);
      const response = await ticketTypesApi.list(eventId!);
      setTicketTypes(response.data.items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete ticket type';
      setError(message);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Link to="/organizer" className="text-primary-600 hover:text-primary-500">
          ← Back to Organizer Dashboard
        </Link>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return null;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/organizer" className="text-primary-600 hover:text-primary-500 text-sm">
            ← Back to Organizer Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{event.title} - Ticket Types</h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
        >
          + Add Ticket Type
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md flex items-center justify-between animate-fade-in">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">✕</button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {ticketTypes.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 mb-4">No ticket types yet</p>
            <p className="text-sm text-gray-400 mb-4">Create ticket types to allow attendees to purchase tickets</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
            >
              Create Your First Ticket Type
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {ticketTypes.map((tt) => (
              <TicketTypeRow
                key={tt.id}
                ticketType={tt}
                onEdit={setEditingTicketType}
                onDelete={handleDeleteTicketType}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Ticket Type Modal */}
      {showCreateModal && (
        <CreateTicketTypeModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateTicketType}
        />
      )}

      {/* Edit Ticket Type Modal */}
      {editingTicketType && (
        <EditTicketTypeModal
          ticketType={editingTicketType}
          onClose={() => setEditingTicketType(null)}
          onSubmit={handleUpdateTicketType}
        />
      )}
    </div>
  );
}

function TicketTypeRow({
  ticketType,
  onEdit,
  onDelete,
}: {
  ticketType: TicketType;
  onEdit: (tt: TicketType) => void;
  onDelete: (id: string) => void;
}) {
  const salesStart = new Date(ticketType.salesStartAt);
  const salesEnd = new Date(ticketType.salesEndAt);
  const now = new Date();
  const isOnSale = salesStart <= now && salesEnd >= now;

  return (
    <div className="px-6 py-4 hover:bg-gray-50">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{ticketType.name}</h3>
            <p className="text-sm text-gray-500">{ticketType.description || 'No description'}</p>
            <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
              <span>Price: <span className="font-medium text-gray-900">{formatCurrency(ticketType.price)}</span></span>
              <span>Qty: <span className="font-medium text-gray-900">{ticketType.quantity}</span></span>
              <span>
                Sales: <span className="font-medium text-gray-900">{formatDate(ticketType.salesStartAt)} - {formatDate(ticketType.salesEndAt)}</span>
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isOnSale ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {isOnSale ? 'On Sale' : 'Not On Sale'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onEdit(ticketType)}
            className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(ticketType.id)}
            className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateTicketTypeModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: CreateTicketTypeRequest) => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    quantity: 1,
    salesStartAt: '',
    salesEndAt: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const submitData = { ...formData };
      // Convert datetime-local format (YYYY-MM-DDTHH:mm) to ISO 8601 with seconds
      if (submitData.salesStartAt && submitData.salesStartAt.length === 16) {
        submitData.salesStartAt = `${submitData.salesStartAt}:00`;
      }
      if (submitData.salesEndAt && submitData.salesEndAt.length === 16) {
        submitData.salesEndAt = `${submitData.salesEndAt}:00`;
      }
      await onSubmit(submitData as CreateTicketTypeRequest);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket type');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Create Ticket Type</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => handleChange('price', parseFloat(e.target.value) || 0)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => handleChange('quantity', parseInt(e.target.value) || 1)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sales Start</label>
                <input
                  type="datetime-local"
                  value={formData.salesStartAt}
                  onChange={(e) => handleChange('salesStartAt', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sales End</label>
                <input
                  type="datetime-local"
                  value={formData.salesEndAt}
                  onChange={(e) => handleChange('salesEndAt', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={isLoading} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md disabled:opacity-50">
                {isLoading ? 'Creating...' : 'Create Ticket Type'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function EditTicketTypeModal({
  ticketType,
  onClose,
  onSubmit,
}: {
  ticketType: TicketType;
  onClose: () => void;
  onSubmit: (data: UpdateTicketTypeRequest) => void;
}) {
  const [formData, setFormData] = useState({
    name: ticketType.name,
    description: ticketType.description || '',
    price: parseFloat(ticketType.price),
    quantity: ticketType.quantity,
    salesStartAt: ticketType.salesStartAt.slice(0, 16),
    salesEndAt: ticketType.salesEndAt.slice(0, 16),
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const submitData = { ...formData };
      // Convert datetime-local format (YYYY-MM-DDTHH:mm) to ISO 8601 with seconds
      if (submitData.salesStartAt && submitData.salesStartAt.length === 16) {
        submitData.salesStartAt = `${submitData.salesStartAt}:00`;
      }
      if (submitData.salesEndAt && submitData.salesEndAt.length === 16) {
        submitData.salesEndAt = `${submitData.salesEndAt}:00`;
      }
      await onSubmit(submitData as UpdateTicketTypeRequest);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update ticket type');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Ticket Type</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => handleChange('price', parseFloat(e.target.value) || 0)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => handleChange('quantity', parseInt(e.target.value) || 1)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sales Start</label>
                <input
                  type="datetime-local"
                  value={formData.salesStartAt}
                  onChange={(e) => handleChange('salesStartAt', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sales End</label>
                <input
                  type="datetime-local"
                  value={formData.salesEndAt}
                  onChange={(e) => handleChange('salesEndAt', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
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