
import { useEffect, useState } from 'react'
import {
  MapPin,
  Navigation,
  X,
  Home,
  Briefcase,
  MapPinned,
  Trash2,
} from 'lucide-react'
import './LocationSelector.css'

export type SelectedLocation = {
  label: string
  pincode: string
  city: string
  state: string
  address: string
  source: 'manual' | 'gps'
}

type SavedAddress = {
  id: string
  label: string
  pincode: string
  city: string
  state: string
  address: string
  type: 'Home' | 'Work' | 'Other'
}

type Props = {
  open: boolean
  onClose: () => void
  currentLocation: string
  onSelect: (location: SelectedLocation) => void
}

const KEY = 'riya-saved-addresses'

function readAddresses(): SavedAddress[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

export default function LocationSelector({
  open,
  onClose,
  currentLocation,
  onSelect,
}: Props) {
  const [pin, setPin] = useState('209725')
  const [city, setCity] = useState('Kannauj')
  const [address, setAddress] = useState('')
  const [type, setType] = useState<'Home' | 'Work' | 'Other'>('Home')
  const [saved, setSaved] = useState<SavedAddress[]>(readAddresses)
  const [error, setError] = useState('')
  const [gpsBusy, setGpsBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setError('')
      setSaved(readAddresses())
    }
  }, [open])

  if (!open) return null

  const choosePin = () => {
    if (!/^\d{6}$/.test(pin)) {
      setError('Please enter a valid 6-digit PIN code.')
      return
    }

    if (!city.trim()) {
      setError('Please enter your city/locality.')
      return
    }

    onSelect({
      label: `${city.trim()}, ${pin}`,
      pincode: pin,
      city: city.trim(),
      state: 'Uttar Pradesh',
      address: address.trim(),
      source: 'manual',
    })
  }

  const useGps = () => {
    if (!navigator.geolocation) {
      setError('GPS is not supported by this browser.')
      return
    }

    setGpsBusy(true)
    setError('')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords

        const value: SelectedLocation = {
          label: `GPS location (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`,
          pincode: '',
          city: 'GPS selected',
          state: 'Uttar Pradesh',
          address: `${latitude}, ${longitude}`,
          source: 'gps',
        }

        setGpsBusy(false)
        onSelect(value)
      },
      (reason) => {
        setGpsBusy(false)
        setError(
          reason.code === 1
            ? 'Location permission denied. Enter your PIN code manually.'
            : 'Unable to detect location. Please enter PIN code manually.',
        )
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000,
      },
    )
  }

  const saveAddress = () => {
    if (!/^\d{6}$/.test(pin) || !city.trim() || !address.trim()) {
      setError('Enter a valid PIN code, city and complete address before saving.')
      return
    }

    const item: SavedAddress = {
      id: `${Date.now()}`,
      label: `${type} · ${city.trim()}`,
      pincode: pin,
      city: city.trim(),
      state: 'Uttar Pradesh',
      address: address.trim(),
      type,
    }

    const next = [...saved, item]
    setSaved(next)
    localStorage.setItem(KEY, JSON.stringify(next))
    setError('Address saved on this device.')
  }

  const chooseSaved = (item: SavedAddress) => {
    onSelect({
      label: `${item.city}, ${item.pincode}`,
      pincode: item.pincode,
      city: item.city,
      state: item.state,
      address: item.address,
      source: 'manual',
    })
  }

  const removeSaved = (id: string) => {
    const next = saved.filter((item) => item.id !== id)
    setSaved(next)
    localStorage.setItem(KEY, JSON.stringify(next))
  }

  return (
    <div
      className="riya-location-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="riya-location-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="riya-location-title"
      >
        <header className="riya-location-head">
          <div className="riya-location-icon">
            <MapPin size={22} />
          </div>

          <div>
            <h2 id="riya-location-title">Where should we deliver?</h2>
            <p>Current selection: {currentLocation}</p>
          </div>

          <button
            className="riya-location-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X />
          </button>
        </header>

        <button
          className="riya-gps-button"
          onClick={useGps}
          disabled={gpsBusy}
        >
          <Navigation size={18} />
          {gpsBusy ? 'Detecting location…' : 'Use my current location'}
          <span>GPS</span>
        </button>

        <div className="riya-location-divider">
          <span>OR ENTER ADDRESS</span>
        </div>

        <div className="riya-location-fields">
          <label>
            PIN code
            <input
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(event) =>
                setPin(event.target.value.replace(/\D/g, '').slice(0, 6))
              }
              placeholder="6-digit PIN code"
            />
          </label>

          <label>
            City / locality
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="e.g. Kannauj"
            />
          </label>

          <label className="riya-full-field">
            Complete address
            <textarea
              rows={2}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="House no., street, landmark"
            />
          </label>
        </div>

        <div className="riya-save-row">
          <label>
            Save as
            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value as typeof type)
              }
            >
              <option>Home</option>
              <option>Work</option>
              <option>Other</option>
            </select>
          </label>

          <button className="riya-save-address" onClick={saveAddress}>
            Save address
          </button>
        </div>

        {error && (
          <p className="riya-location-message" role="status">
            {error}
          </p>
        )}

        <button className="riya-confirm-location" onClick={choosePin}>
          Confirm delivery location
        </button>

        {saved.length > 0 && (
          <div className="riya-saved-list">
            <h3>Saved addresses</h3>

            {saved.map((item) => (
              <div className="riya-saved-item" key={item.id}>
                <button
                  className="riya-saved-main"
                  onClick={() => chooseSaved(item)}
                >
                  {item.type === 'Home' ? (
                    <Home />
                  ) : item.type === 'Work' ? (
                    <Briefcase />
                  ) : (
                    <MapPinned />
                  )}

                  <span>
                    <b>{item.label}</b>
                    <small>
                      {item.address}, {item.pincode}
                    </small>
                  </span>
                </button>

                <button
                  className="riya-remove-address"
                  onClick={() => removeSaved(item.id)}
                  aria-label="Delete saved address"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="riya-location-note">
          PIN format is checked on this screen. Actual delivery coverage
          and GPS address lookup will be confirmed when the serviceability
          backend is connected.
        </p>
      </section>
    </div>
  )
}
