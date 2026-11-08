import { useCallback, useEffect, useState } from 'react'
import {
  X, Package, Truck, CheckCircle2, Clock,
  MapPin, RefreshCw, Ban, ChevronRight
} from 'lucide-react'
import {
  fetchCustomerOrders,
  fetchCustomerOrder,
  cancelCustomerOrder,
  type Customer,
  type CustomerOrder
} from '../services/customerApi'
import './MyOrders.css'

type Props = {
  customer: Customer
  onClose: () => void
}

const steps = [
  'Placed',
  'Confirmed',
  'Packed',
  'Ready for Dispatch',
  'Out for Delivery',
  'Delivered'
]

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

function money(value: number) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`
}

function MyOrders({ customer, onClose }: Props) {
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [selected, setSelected] = useState<CustomerOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await fetchCustomerOrders()
      setOrders(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load orders.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  // Automatically refresh the selected order every 10 seconds.
  // Stop polling when the order reaches a terminal status.
  useEffect(() => {
    if (!selected) return

    const status = (selected.status || '').toLowerCase()
    if (['delivered', 'cancelled'].includes(status)) return

    let active = true
    let inFlight = false

    const timer = window.setInterval(async () => {
      if (!active || inFlight) return

      inFlight = true
      try {
        const detail = await fetchCustomerOrder(selected.id)

        if (active) {
          setSelected(detail)
          setOrders(previous =>
            previous.map(order =>
              order.id === detail.id ? { ...order, ...detail } : order
            )
          )
        }
      } catch {
        // Keep the last successfully loaded order visible.
      } finally {
        inFlight = false
      }
    }, 10000)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [selected?.id, selected?.status])

  async function openOrder(order: CustomerOrder) {
    setSelected(order)
    setDetailLoading(true)
    try {
      const detail = await fetchCustomerOrder(order.id)
      setSelected(detail)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load order details.')
    } finally {
      setDetailLoading(false)
    }
  }

  async function refreshSelected() {
    if (!selected) return
    setDetailLoading(true)
    try {
      const detail = await fetchCustomerOrder(selected.id)
      setSelected(detail)
      await loadOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh tracking.')
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleCancel() {
    if (!selected) return

    const confirmed = window.confirm(
      `Cancel order ${selected.order_number}? This action cannot be undone.`
    )
    if (!confirmed) return

    setActionLoading(true)
    setError('')
    try {
      await cancelCustomerOrder(selected.id, 'Cancelled by customer')
      const updated = await fetchCustomerOrder(selected.id)
      setSelected(updated)
      await loadOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel this order.')
    } finally {
      setActionLoading(false)
    }
  }

  const currentStatus = (selected?.status || '').toLowerCase()
  const cancelled = currentStatus === 'cancelled'
  const canCancel = ['placed', 'confirmed'].includes(currentStatus)
  const currentStep = steps.findIndex(
    step => step.toLowerCase() === currentStatus
  )

  return (
    <div className="my-orders-overlay" onClick={onClose}>
      <section
        className="my-orders-panel"
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="My Orders"
      >
        <header className="my-orders-header">
          <div>
            <span className="my-orders-eyebrow">RIYA QUICK COMMERCE</span>
            <h2>{selected ? 'Order Details' : 'My Orders'}</h2>
            <p>{customer.name} · {customer.email}</p>
          </div>
          <button className="my-orders-icon-button" onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        </header>

        {error && <div className="my-orders-error">{error}</div>}

        {selected ? (
          <div className="my-orders-content">
            <button className="my-orders-back" onClick={() => setSelected(null)}>
              ← Back to My Orders
            </button>

            <div className="my-order-summary">
              <div>
                <span>ORDER NUMBER</span>
                <strong>{selected.order_number}</strong>
                <small>{formatDate(selected.created_at)}</small>
              </div>
              <span className={`my-order-status ${cancelled ? 'cancelled' : ''}`}>
                {selected.status}
              </span>
            </div>

            <div className="my-order-section">
              <div className="my-order-section-heading">
                <h3><Truck size={19} /> Order Tracking</h3>
                <button
                  className="my-orders-refresh"
                  onClick={refreshSelected}
                  disabled={detailLoading}
                >
                  <RefreshCw size={16} /> Refresh
                </button>
              </div>

              {cancelled ? (
                <div className="my-order-cancelled">
                  <Ban size={22} />
                  <div>
                    <strong>Order Cancelled</strong>
                    <p>{selected.cancellation_reason || 'This order has been cancelled.'}</p>
                  </div>
                </div>
              ) : (
                <div className="my-order-timeline">
                  {steps.map((step, index) => {
                    const completed = currentStep >= index
                    return (
                      <div className={`my-order-step ${completed ? 'completed' : ''}`} key={step}>
                        <div className="my-order-step-marker">
                          {completed ? <CheckCircle2 size={19} /> : <Clock size={19} />}
                        </div>
                        <div>
                          <strong>{step}</strong>
                          {selected.events?.filter(
                            event => event.new_status.toLowerCase() === step.toLowerCase()
                          ).map((event, eventIndex) => (
                            <small key={`${step}-${eventIndex}`}>
                              {event.note} · {formatDate(event.created_at)}
                            </small>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {detailLoading && <p className="my-orders-muted">Refreshing order information...</p>}
            </div>

            <div className="my-order-section">
              <h3><Package size={19} /> Items Ordered</h3>
              {selected.items?.length ? selected.items.map((item, index) => (
                <div className="my-order-item" key={item.id ?? `${item.product_id}-${index}`}>
                  <div>
                    <strong>{item.product_name}</strong>
                    <small>Qty: {item.quantity} × {money(item.unit_price)}</small>
                  </div>
                  <strong>{money(item.line_total)}</strong>
                </div>
              )) : <p className="my-orders-muted">No item details available.</p>}
            </div>

            <div className="my-order-section">
              <h3><MapPin size={19} /> Delivery Address</h3>
              <p className="my-order-address">
                {[selected.delivery_address, selected.delivery_city,
                  selected.delivery_state, selected.delivery_pincode]
                  .filter(Boolean).join(', ') || 'Address not available'}
              </p>
            </div>

            <div className="my-order-total">
              <div><span>Subtotal</span><strong>{money(selected.subtotal)}</strong></div>
              <div><span>Delivery Fee</span><strong>{money(selected.delivery_fee)}</strong></div>
              <div><span>Discount</span><strong>-{money(selected.discount)}</strong></div>
              <div className="my-order-grand-total">
                <span>Total Amount</span><strong>{money(selected.total_amount)}</strong>
              </div>
              <div><span>Payment Method</span><strong>{selected.payment_method}</strong></div>
              <div><span>Payment Status</span><strong>{selected.payment_status}</strong></div>
            </div>

            {canCancel && (
              <button
                className="my-order-cancel-button"
                onClick={handleCancel}
                disabled={actionLoading}
              >
                <Ban size={17} />
                {actionLoading ? 'Cancelling...' : 'Cancel Order'}
              </button>
            )}
          </div>
        ) : (
          <div className="my-orders-content">
            <div className="my-orders-list-heading">
              <div>
                <h3>Your Orders</h3>
                <p>View purchases and track deliveries.</p>
              </div>
              <button
                className="my-orders-refresh"
                onClick={loadOrders}
                disabled={loading}
              >
                <RefreshCw size={16} /> Refresh
              </button>
            </div>

            {loading ? (
              <p className="my-orders-empty">Loading your orders...</p>
            ) : orders.length === 0 ? (
              <div className="my-orders-empty">
                <Package size={42} />
                <h3>No orders yet</h3>
                <p>Your orders will appear here after checkout.</p>
              </div>
            ) : (
              <div className="my-orders-list">
                {orders.map(order => (
                  <button
                    className="my-order-card"
                    key={order.id}
                    onClick={() => openOrder(order)}
                  >
                    <div className="my-order-card-icon"><Package size={21} /></div>
                    <div className="my-order-card-main">
                      <strong>{order.order_number}</strong>
                      <small>{formatDate(order.created_at)}</small>
                      <span className={`my-order-status ${order.status.toLowerCase() === 'cancelled' ? 'cancelled' : ''}`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="my-order-card-right">
                      <strong>{money(order.total_amount)}</strong>
                      <ChevronRight size={19} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

export default MyOrders

