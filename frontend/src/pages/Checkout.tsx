import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { reservationsApi, ordersApi, paymentsApi } from '../api/endpoints';
import { useAuth } from '../context/useAuth';
import type { Reservation, Order, Payment } from '../types/api';

function formatPrice(price: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(price));
}

function generateIdempotencyKey(orderId: string): string {
  return `payment-${orderId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const reservationId = searchParams.get('reservation');

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!reservationId) {
      navigate('/events');
      return;
    }

    let mounted = true;

    async function fetchReservation() {
      if (!reservationId) return;
      try {
        setIsLoading(true);
        const response = await reservationsApi.get(reservationId);
        if (mounted) {
          setReservation(response.data);
          setError(null);
        }
      } catch (err: unknown) {
        if (mounted) {
          const message = err instanceof Error ? err.message : 'Failed to load reservation';
          setError(message);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchReservation();

    return () => {
      mounted = false;
    };
  }, [reservationId, isAuthenticated, navigate]);

  const handleCreateOrder = async () => {
    if (!reservation) return;

    setCreatingOrder(true);
    setError(null);

    try {
      const response = await ordersApi.create({
        items: [{ ticketTypeId: reservation.ticketTypeId, quantity: reservation.quantity }],
      });
      const newOrder = response.data;
      setOrder(newOrder);
      setIdempotencyKey(generateIdempotencyKey(newOrder.id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create order';
      setError(message);
    } finally {
      setCreatingOrder(false);
    }
  };

  const handlePayment = async () => {
    if (!order || !idempotencyKey) return;

    setProcessingPayment(true);
    setError(null);

    try {
      const response = await paymentsApi.create(order.id, idempotencyKey);
      setPayment(response.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      setError(message);
    } finally {
      setProcessingPayment(false);
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

  if (error && !reservation) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="text-center py-12">
            <p className="text-red-600">{error}</p>
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

  if (!reservation) {
    return null;
  }

  const ticketType = reservation.ticketType;
  const unitPrice = ticketType?.price || '0';
  const totalAmount = Number(unitPrice) * reservation.quantity;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <Link to="/events" className="text-primary-600 hover:text-primary-500">
          ← Back to Events
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
        </div>

        <div className="p-6 space-y-6">
          {/* Reservation Summary */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Reservation Summary</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{ticketType?.name}</p>
                <p className="text-sm text-gray-500">
                  {ticketType?.event?.title}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium text-gray-900">{formatPrice(unitPrice)} × {reservation.quantity}</p>
                <p className="text-sm text-gray-500">Expires: {new Date(reservation.expiresAt).toLocaleString()}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between font-medium">
              <span>Total</span>
              <span>{formatPrice(totalAmount.toFixed(2))}</span>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-md flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800"
              >
                ✕
              </button>
            </div>
          )}

          {/* Step 1: Create Order */}
          {!order && (
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Step 1: Create Order</h3>
              <p className="text-gray-600 mb-4">
                Your reservation is active. Create an order to proceed to payment.
              </p>
              <button
                onClick={handleCreateOrder}
                disabled={creatingOrder}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
              >
                {creatingOrder ? 'Creating Order...' : 'Create Order'}
              </button>
            </div>
          )}

          {/* Step 2: Payment */}
          {order && !payment && (
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Step 2: Payment</h3>
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between">
                  <span className="text-gray-600">Order Total</span>
                  <span className="font-semibold text-gray-900">{formatPrice(order.totalAmount)}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-gray-500">Order ID</span>
                  <span className="font-mono text-gray-900">{order.id}</span>
                </div>
              </div>
              <button
                onClick={handlePayment}
                disabled={processingPayment}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                {processingPayment ? 'Processing Payment...' : 'Pay Now'}
              </button>
            </div>
          )}

          {/* Step 3: Payment Result */}
          {payment && (
            <div className={`border rounded-lg p-6 ${payment.status === 'SUCCEEDED' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {payment.status === 'SUCCEEDED' ? '✓ Payment Successful' : '✗ Payment Failed'}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Status</span>
                  <span className={`font-medium ${payment.status === 'SUCCEEDED' ? 'text-green-600' : 'text-red-600'}`}>
                    {payment.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount</span>
                  <span className="font-medium text-gray-900">{formatPrice(payment.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Order ID</span>
                  <span className="font-mono text-gray-900">{payment.orderId}</span>
                </div>
              </div>

              {payment.status === 'SUCCEEDED' && (
                <div className="mt-4">
                  <Link
                    to={`/tickets?order=${payment.orderId}`}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                  >
                    View My Tickets
                  </Link>
                </div>
              )}

              {payment.status === 'FAILED' && order && (
                <div className="mt-4">
                  <button
                    onClick={() => {
                      setPayment(null);
                      setOrder(null);
                      setIdempotencyKey(generateIdempotencyKey(order.id));
                    }}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}