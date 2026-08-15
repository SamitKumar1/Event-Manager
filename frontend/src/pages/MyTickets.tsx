import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ticketsApi } from '../api/endpoints';
import { useAuth } from '../context/useAuth';
import type { Ticket } from '../types/api';

export default function MyTickets() {
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order');

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    if (!isAuthenticated) return;

    let mounted = true;

    async function fetchTickets() {
      try {
        setIsLoading(true);
        const response = await ticketsApi.listMine(pagination.page, pagination.limit);
        if (mounted) {
          let items = response.data.items;

          // If orderId is provided, filter tickets for that order
          if (orderId) {
            items = items.filter((t) => t.orderId === orderId);
          }

          setTickets(items);
          setPagination({
            page: response.data.page,
            limit: response.data.limit,
            total: response.data.total,
            totalPages: response.data.totalPages,
          });
          setError(null);
        }
      } catch (err: unknown) {
        if (mounted) {
          const message = err instanceof Error ? err.message : 'Failed to load tickets';
          setError(message);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchTickets();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, pagination.page, orderId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Tickets</h1>
          <p className="mt-1 text-gray-600">View and manage your tickets</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Tickets</h1>
        <p className="mt-1 text-gray-600">View and manage your tickets</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md">
          Failed to load tickets: {error}
        </div>
      )}

      {tickets.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="text-center py-12">
            <p className="text-gray-500">{orderId ? 'No tickets found for this order' : 'No tickets yet'}</p>
            <p className="text-sm text-gray-400 mt-1">
              {orderId ? 'Try checking all your tickets' : 'Purchase tickets from events to see them here'}
            </p>
            {!orderId && (
              <Link
                to="/events"
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
              >
                Browse Events
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-200">
              {tickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
            </div>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2">
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  const eventTitle = ticket.order?.items[0]?.ticketType?.event?.title || 'Event';
  const ticketTypeName = ticket.ticketType?.name || 'Ticket';

  return (
    <div className="p-6 hover:bg-gray-50">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center font-mono text-xs text-gray-500">
            QR
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">{eventTitle}</h3>
            <p className="text-sm text-gray-500">{ticketTypeName}</p>
            <p className="text-sm text-gray-500 font-mono">{ticket.ticketCode}</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 flex items-center space-x-4">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              ticket.status === 'VALID'
                ? 'bg-green-100 text-green-800'
                : ticket.status === 'USED'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-red-100 text-red-800'
            }`}
          >
            {ticket.status}
          </span>
          <Link
            to={`/tickets/${ticket.id}`}
            className="text-primary-600 hover:text-primary-500 text-sm font-medium"
          >
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
}