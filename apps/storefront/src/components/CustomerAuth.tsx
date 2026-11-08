import { useState } from 'react'
import {
  loginCustomer,
  registerCustomer,
  resendCustomerEmailOtp,
  verifyCustomerEmailOtp,
  type Customer
} from '../services/customerApi'
import './CustomerAuth.css'

type Props = {
  onClose: () => void
  onSuccess: (customer: Customer) => void
}

export default function CustomerAuth({ onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [verificationStep, setVerificationStep] = useState(false)
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [verificationEmail, setVerificationEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  function startResendCooldown() {
    setResendCooldown(60)

    const interval = window.setInterval(() => {
      setResendCooldown((current) => {
        if (current <= 1) {
          window.clearInterval(interval)
          return 0
        }

        return current - 1
      })
    }, 1000)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'login') {
        const customer = await loginCustomer({
          email: email.trim(),
          password
        })

        onSuccess(customer)
        onClose()
        return
      }

      const result = await registerCustomer({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password
      })

      if (result.requiresEmailVerification) {
        setCustomerId(result.customerId)
        setVerificationEmail(result.email)
        setVerificationStep(true)
        setOtp('')
        startResendCooldown()
        return
      }

      setError('Email verification is required to continue.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!customerId) {
      setError('Verification session is missing. Please register again.')
      return
    }

    if (!/^\d{6}$/.test(otp)) {
      setError('Please enter the 6-digit OTP sent to your email.')
      return
    }

    setLoading(true)

    try {
      const customer = await verifyCustomerEmailOtp({
        customerId,
        otp
      })

      onSuccess(customer)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResendOtp() {
    if (!customerId || resendCooldown > 0 || resendLoading) return

    setError('')
    setResendLoading(true)

    try {
      const result = await resendCustomerEmailOtp(customerId)

      setVerificationEmail(result.email)
      setOtp('')
      startResendCooldown()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend OTP.')
    } finally {
      setResendLoading(false)
    }
  }

  function switchMode(nextMode: 'login' | 'register') {
    setMode(nextMode)
    setError('')
    setVerificationStep(false)
    setCustomerId(null)
    setVerificationEmail('')
    setOtp('')
    setResendCooldown(0)
  }

  if (verificationStep) {
    return (
      <div className="customer-auth-overlay" onClick={onClose}>
        <section
          className="customer-auth-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-auth-title"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="customer-auth-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>

          <div className="customer-auth-brand">RIYA SOLAR</div>

          <h2 id="customer-auth-title">
            Verify your email
          </h2>

          <p className="customer-auth-subtitle">
            We sent a 6-digit verification code to{' '}
            <strong>{verificationEmail}</strong>.
          </p>

          <form onSubmit={handleVerifyOtp}>
            <label htmlFor="customer-email-otp">
              Email verification OTP
            </label>

            <input
              id="customer-email-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(event) => {
                const value = event.target.value
                  .replace(/\D/g, '')
                  .slice(0, 6)

                setOtp(value)
                setError('')
              }}
              placeholder="Enter 6-digit OTP"
              maxLength={6}
              required
              autoFocus
            />

            {error && (
              <div className="customer-auth-error">
                {error}
              </div>
            )}

            <button
              className="customer-auth-submit"
              type="submit"
              disabled={loading || otp.length !== 6}
            >
              {loading ? 'Verifying...' : 'Verify email'}
            </button>
          </form>

          <p className="customer-auth-footer">
            OTP is valid for 10 minutes. Do not share it with anyone.
          </p>

          <button
            type="button"
            className="customer-auth-submit"
            onClick={handleResendOtp}
            disabled={resendLoading || resendCooldown > 0}
            style={{
              marginTop: 8,
              background: 'transparent',
              color: '#238447',
              border: '1px solid #dce6de'
            }}
          >
            {resendLoading
              ? 'Sending...'
              : resendCooldown > 0
                ? `Resend OTP in ${resendCooldown}s`
                : 'Resend OTP'}
          </button>

          <button
            type="button"
            onClick={() => switchMode('register')}
            disabled={loading || resendLoading}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 12,
              padding: 0,
              border: 0,
              background: 'transparent',
              color: '#718078',
              cursor: 'pointer',
              fontSize: 13
            }}
          >
            Use a different account
          </button>
        </section>
      </div>
    )
  }

  return (
    <div className="customer-auth-overlay" onClick={onClose}>
      <section
        className="customer-auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-auth-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="customer-auth-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <div className="customer-auth-brand">RIYA SOLAR</div>

        <h2 id="customer-auth-title">
          {mode === 'login' ? 'Welcome back!' : 'Create your account'}
        </h2>

        <p className="customer-auth-subtitle">
          {mode === 'login'
            ? 'Login to continue shopping and track your orders.'
            : 'Register to place and manage your orders.'}
        </p>

        <div className="customer-auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => switchMode('login')}
          >
            Login
          </button>

          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => switchMode('register')}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <label htmlFor="auth-name">Full name</label>

              <input
                id="auth-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your full name"
                autoComplete="name"
                required
                maxLength={100}
              />

              <label htmlFor="auth-phone">Mobile number</label>

              <input
                id="auth-phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="10-digit mobile number"
                autoComplete="tel"
                pattern="[0-9]{10}"
                maxLength={10}
                required
              />
            </>
          )}

          <label htmlFor="auth-email">Email address</label>

          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            maxLength={254}
            required
          />

          <label htmlFor="auth-password">Password</label>

          <input
            id="auth-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={
              mode === 'register'
                ? 'Create a password'
                : 'Enter your password'
            }
            autoComplete={
              mode === 'register' ? 'new-password' : 'current-password'
            }
            minLength={8}
            maxLength={72}
            required
          />

          {error && (
            <div className="customer-auth-error">
              {error}
            </div>
          )}

          <button
            className="customer-auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Login securely'
                : 'Create account'}
          </button>
        </form>

        <p className="customer-auth-footer">
          Your account is protected by secure authentication.
        </p>
      </section>
    </div>
  )
}
