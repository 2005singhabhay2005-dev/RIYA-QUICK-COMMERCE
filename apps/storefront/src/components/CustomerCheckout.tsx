import { useState } from 'react'
import { X, MapPin, PackageCheck, Truck } from 'lucide-react'
import {
  placeCustomerOrder,
  type Customer,
  type CustomerOrder
} from '../services/customerApi'
import './CustomerCheckout.css'

type CheckoutItem = {
  id: number
  name: string
  price: number
  quantity: number
}

type Props = {
  customer: Customer
  items: CheckoutItem[]
  onClose: () => void
  onSuccess: (order: CustomerOrder) => void
}

export default function CustomerCheckout({
  customer,
  items,
  onClose,
  onSuccess
}: Props) {
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('Kannauj')
  const [state, setState] = useState('Uttar Pradesh')
  const [pincode, setPincode] = useState('209725')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!items.length) {
      setError('Your cart is empty.')
      return
    }

    setLoading(true)

    try {
      const result = await placeCustomerOrder({
        items: items.map(item => ({
          product_id: item.id,
          quantity: item.quantity
        })),
        delivery_address: address.trim(),
        delivery_city: city.trim(),
        delivery_state: state.trim(),
        delivery_pincode: pincode.trim(),
        customer_notes: notes.trim()
      })

      onSuccess(result.order)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to place your order. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="checkout-overlay" onClick={onClose}>
      <section
        className="checkout-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        onClick={event => event.stopPropagation()}
      >
        <header className="checkout-header">
          <div>
            <span className="checkout-eyebrow">RIYA QUICK COMMERCE</span>
            <h2 id="checkout-title">Complete your order</h2>
            <p>Delivery details and payment</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close checkout">
            <X size={22} />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="checkout-section-title">
            <MapPin size={19} />
            <h3>Delivery information</h3>
          </div>

          <div className="checkout-customer">
            <strong>{customer.name}</strong>
            <span>{customer.email}</span>
            <span>{customer.phone}</span>
          </div>

          <label htmlFor="delivery-address">Full delivery address</label>
          <textarea
            id="delivery-address"
            value={address}
            onChange={event => setAddress(event.target.value)}
            placeholder="House number, street, landmark..."
            rows={3}
            maxLength={500}
            required
          />

          <div className="checkout-form-grid">
            <div>
              <label htmlFor="delivery-city">City</label>
              <input
                id="delivery-city"
                value={city}
                onChange={event => setCity(event.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div>
              <label htmlFor="delivery-state">State</label>
              <input
                id="delivery-state"
                value={state}
                onChange={event => setState(event.target.value)}
                required
                maxLength={100}
              />
            </div>
          </div>

          <label htmlFor="delivery-pincode">PIN code</label>
          <input
            id="delivery-pincode"
            value={pincode}
            onChange={event =>
              setPincode(event.target.value.replace(/\D/g, '').slice(0, 6))
            }
            inputMode="numeric"
            pattern="[0-9]{6}"
            placeholder="6-digit PIN code"
            required
          />

          <label htmlFor="delivery-notes">Delivery instructions (optional)</label>
          <textarea
            id="delivery-notes"
            value={notes}
            onChange={event => setNotes(event.target.value)}
            placeholder="Any special delivery instructions?"
            rows={2}
            maxLength={500}
          />

          <div className="checkout-section-title checkout-payment-title">
            <Truck size={19} />
            <h3>Payment method</h3>
          </div>

          <div className="checkout-cod">
            <span className="checkout-cod-icon">₹</span>
            <div>
              <strong>Cash on Delivery</strong>
              <small>Pay when your order arrives.</small>
            </div>
            <span className="checkout-selected">Selected</span>
          </div>

          <div className="checkout-order-summary">
            <div className="checkout-section-title">
              <PackageCheck size={19} />
              <h3>Order summary</h3>
            </div>

            {items.map(item => (
              <div className="checkout-item" key={item.id}>
                <span>{item.name} × {item.quantity}</span>
                <strong>
                  ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                </strong>
              </div>
            ))}

            <div className="checkout-grand-total">
              <span>Items total</span>
              <strong>₹{total.toLocaleString('en-IN')}</strong>
            </div>
            <small>Delivery fee, if applicable, is calculated by the server.</small>
          </div>

          {error && (
            <div className="checkout-error" role="alert">{error}</div>
          )}

          <button
            type="submit"
            className="checkout-place-order"
            disabled={loading || items.length === 0}
          >
            {loading ? 'Placing your order...' : 'Place COD order'}
          </button>
          <p className="checkout-secure-note">
            Your order will be confirmed by the server.
          </p>
        </form>
      </section>
    </div>
  )
}
