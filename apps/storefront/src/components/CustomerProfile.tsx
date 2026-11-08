import { useCallback, useEffect, useState } from 'react'
import {
  X, UserRound, MapPin, Plus, Pencil, Trash2,
  Star, Save, RefreshCw, CheckCircle2
} from 'lucide-react'
import {
  fetchCustomerAccountProfile,
  updateCustomerAccountProfile,
  fetchCustomerAddresses,
  createCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setCustomerAddressDefault,
    changeCustomerPassword,
  type Customer,
  type CustomerProfile as CustomerProfileData,
  type CustomerAddress
} from '../services/customerApi'
import './CustomerProfile.css'

type Props = {
  customer: Customer
  onClose: () => void
  onCustomerUpdated?: (customer: Customer) => void
}

type AddressForm = {
  label: string
  fullName: string
  phone: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  pincode: string
  landmark: string
}

const emptyAddressForm: AddressForm = {
  label: 'Home',
  fullName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: 'Uttar Pradesh',
  pincode: '',
  landmark: ''
}

function CustomerProfile({
  customer,
  onClose,
  onCustomerUpdated
}: Props) {
  const [profile, setProfile] = useState<CustomerProfileData | null>(null)
  const [addresses, setAddresses] = useState<CustomerAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
const [passwordForm, setPasswordForm] = useState({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})
  const [savingAddress, setSavingAddress] = useState(false)
  const [actionAddressId, setActionAddressId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [profileForm, setProfileForm] = useState({
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    dateOfBirth: '',
    gender: '',
    language: 'hi',
    currency: 'INR'
  })

  const [addressForm, setAddressForm] = useState<AddressForm>(emptyAddressForm)
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null)
  const [addressFormOpen, setAddressFormOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<
  'personal' | 'security' | 'addresses'
>('personal')

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [profileResult, addressResult] = await Promise.all([
        fetchCustomerAccountProfile(),
        fetchCustomerAddresses()
      ])

      setProfile(profileResult)
      setAddresses(addressResult)

      setProfileForm({
        name: profileResult.name,
        email: profileResult.email,
        phone: profileResult.phone,
        dateOfBirth: profileResult.date_of_birth || '',
        gender: profileResult.gender || '',
        language: profileResult.language || 'hi',
        currency: profileResult.currency || 'INR'
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load customer profile.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  function showSuccess(message: string) {
    setSuccess(message)
    window.setTimeout(() => setSuccess(''), 3000)
  }

  async function handleProfileSave(event: React.FormEvent) {
    event.preventDefault()
    setSavingProfile(true)
    setError('')

    try {
      const updated = await updateCustomerAccountProfile({
        name: profileForm.name,
        email: profileForm.email,
        phone: profileForm.phone,
        dateOfBirth: profileForm.dateOfBirth,
        gender: profileForm.gender,
        language: profileForm.language,
        currency: profileForm.currency
      })

      setProfile(updated)

      const updatedCustomer: Customer = {
        id: updated.customer_id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone
      }

      onCustomerUpdated?.(updatedCustomer)
      showSuccess('Profile updated successfully.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update profile.'
      )
    } finally {
      setSavingProfile(false)
    }
  }
   async function handlePasswordChange(event: React.FormEvent) {
    event.preventDefault()
    setError('')

    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setError('Current password and new password are required.')
      return
    }

    if (passwordForm.newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New password and confirm password do not match.')
      return
    }

    setChangingPassword(true)

    try {
      const result = await changeCustomerPassword(
        passwordForm.currentPassword,
        passwordForm.newPassword
      )

      if (!result.success) {
        setError(result.message || 'Unable to change password.')
        return
      }

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })

      showSuccess('Password changed successfully.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to change password.'
      )
    } finally {
      setChangingPassword(false)
    }
  }

  function openAddAddress() {
    setEditingAddressId(null)
    setAddressForm({
      ...emptyAddressForm,
      fullName: profile?.name || customer.name,
      phone: profile?.phone || customer.phone
    })
    setAddressFormOpen(true)
    setError('')
  }

  function openEditAddress(address: CustomerAddress) {
    setEditingAddressId(address.id)
    setAddressForm({
      label: address.label,
      fullName: address.full_name,
      phone: address.phone,
      addressLine1: address.address_line1,
      addressLine2: address.address_line2 || '',
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      landmark: address.landmark || ''
    })
    setAddressFormOpen(true)
    setError('')
  }

  function closeAddressForm() {
    setAddressFormOpen(false)
    setEditingAddressId(null)
  }

  async function handleAddressSave(event: React.FormEvent) {
    event.preventDefault()
    setSavingAddress(true)
    setError('')

    try {
      if (editingAddressId) {
        await updateCustomerAddress(editingAddressId, addressForm)
        showSuccess('Address updated successfully.')
      } else {
        await createCustomerAddress(addressForm)
        showSuccess('Address added successfully.')
      }

      const updatedAddresses = await fetchCustomerAddresses()
      setAddresses(updatedAddresses)
      closeAddressForm()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save address.'
      )
    } finally {
      setSavingAddress(false)
    }
  }

  async function handleSetDefault(id: number) {
    setActionAddressId(id)
    setError('')

    try {
      await setCustomerAddressDefault(id)
      const updatedAddresses = await fetchCustomerAddresses()
      setAddresses(updatedAddresses)
      showSuccess('Default address updated.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to change default address.'
      )
    } finally {
      setActionAddressId(null)
    }
  }

  async function handleDeleteAddress(address: CustomerAddress) {
    const confirmed = window.confirm(
      `Delete "${address.label}" address?`
    )

    if (!confirmed) return

    setActionAddressId(address.id)
    setError('')

    try {
      await deleteCustomerAddress(address.id)
      const updatedAddresses = await fetchCustomerAddresses()
      setAddresses(updatedAddresses)
      showSuccess('Address deleted successfully.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete address.'
      )
    } finally {
      setActionAddressId(null)
    }
  }

  return (
    <div className="customer-profile-overlay" onClick={onClose}>
      <section
        className="customer-profile-panel"
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="My Profile"
      >
        <header className="customer-profile-header">
          <div>
            <span className="customer-profile-eyebrow">
              RIYA QUICK COMMERCE
            </span>

            <h2>My Profile</h2>

            <p>
              Manage your personal details and saved delivery addresses.
            </p>
          </div>

          <button
            className="customer-profile-icon-button"
            onClick={onClose}
            aria-label="Close profile"
          >
            <X size={22} />
          </button>
        </header>

        {error && (
          <div className="customer-profile-error">
            {error}
          </div>
        )}

        {success && (
          <div className="customer-profile-success">
            <CheckCircle2 size={17} />
            <span>{success}</span>
          </div>
        )}

        {loading ? (
          <div className="customer-profile-loading">
            <RefreshCw size={22} className="customer-profile-spin" />
            <p>Loading your profile...</p>
          </div>
        ) : (
          <div className="customer-profile-content">
            <section className="customer-profile-section">
             
             <div
  className="customer-profile-section-heading"
  onClick={() =>
    setActiveSection(
      activeSection === 'personal' ? 'security' : 'personal',
    )
  }
  role="button"
  tabIndex={0}
>
  <div>
    <span className="customer-profile-section-icon">
      <UserRound size={17} />
    </span>
    <div>
      <h3>Personal Details</h3>
      <p>Keep your account information up to date.</p>
    </div>
  </div>
</div>
{activeSection === 'personal' && (

              <form
                className="customer-profile-form"
                onSubmit={handleProfileSave}
              >
                
                <label>
                  <span>Full Name</span>
                  <input
                    value={profileForm.name}
                    onChange={event =>
                      setProfileForm({
                        ...profileForm,
                        name: event.target.value
                      })
                    }
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </label>

                <label>
                  <span>Email</span>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={event =>
                      setProfileForm({
                        ...profileForm,
                        email: event.target.value
                      })
                    }
                    required
                  />
                </label>

                <label>
                  <span>Phone</span>
                  <input
                    value={profileForm.phone}
                    onChange={event =>
                      setProfileForm({
                        ...profileForm,
                        phone: event.target.value
                      })
                    }
                    required
                  />
                </label>

                <label>
                  <span>Date of Birth</span>
                  <input
                    type="date"
                    value={profileForm.dateOfBirth}
                    onChange={event =>
                      setProfileForm({
                        ...profileForm,
                        dateOfBirth: event.target.value
                      })
                    }
                  />
                </label>

                <label>
                  <span>Gender</span>
                  <select
                    value={profileForm.gender}
                    onChange={event =>
                      setProfileForm({
                        ...profileForm,
                        gender: event.target.value
                      })
                    }
                  >
                    <option value="">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label>
                  <span>Language</span>
                  <select
                    value={profileForm.language}
                    onChange={event =>
                      setProfileForm({
                        ...profileForm,
                        language: event.target.value
                      })
                    }
                  >
                    <option value="hi">Hindi</option>
                    <option value="en">English</option>
                  </select>
                </label>

                <label>
                  <span>Currency</span>
                  <select
                    value={profileForm.currency}
                    onChange={event =>
                      setProfileForm({
                        ...profileForm,
                        currency: event.target.value
                      })
                    }
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </label>

                <div className="customer-profile-form-actions">
                  <button
                    type="submit"
                    className="customer-profile-primary-button"
                    disabled={savingProfile}
                  >
                    {savingProfile ? (
                      <>
                        <RefreshCw size={16} className="customer-profile-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Profile
                      </>
                    )}
                  </button>
                </div>
              </form>
              )}
            </section>

                        <section className="customer-profile-section">
              <div
                className="customer-profile-section-heading"
                onClick={() =>
                  setActiveSection(
                    activeSection === 'security' ? 'personal' : 'security',
                  )
                }
                role="button"
                tabIndex={0}
              >
                <div>
                  <span className="customer-profile-section-icon">
                    <UserRound size={17} />
                  </span>

                  <div>
                    <h3>Security</h3>
                    <p>Keep your account password secure and up to date.</p>
                  </div>
                </div>
              </div>

              {activeSection === 'security' && (
                <form
                  className="customer-profile-form"
                  onSubmit={handlePasswordChange}
                >
                  <label>
                    <span>Current Password</span>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={event =>
                        setPasswordForm({
                          ...passwordForm,
                          currentPassword: event.target.value
                        })
                      }
                      autoComplete="current-password"
                      required
                    />
                  </label>

                  <label>
                    <span>New Password</span>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={event =>
                        setPasswordForm({
                          ...passwordForm,
                          newPassword: event.target.value
                        })
                      }
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  </label>

                  <label>
                    <span>Confirm New Password</span>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={event =>
                        setPasswordForm({
                          ...passwordForm,
                          confirmPassword: event.target.value
                        })
                      }
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  </label>

                  <div className="customer-profile-form-actions">
                    <button
                      type="submit"
                      className="customer-profile-primary-button"
                      disabled={changingPassword}
                    >
                      {changingPassword ? (
                        <>
                          <RefreshCw
                            size={16}
                            className="customer-profile-spin"
                          />
                          Changing Password...
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          Change Password
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </section>

            <section className="customer-profile-section">
              <div
                className="customer-profile-section-heading"
                onClick={() => setActiveSection('addresses')}
                role="button"
                tabIndex={0}
              >
                <div>
                  <span className="customer-profile-section-icon">
                    <MapPin size={17} />
                  </span>

                  <div>
                    <h3>Saved Addresses</h3>
                    <p>Save Home, Office and other delivery locations.</p>
                  </div>
                </div>

                <button
                  className="customer-profile-add-button"
                  onClick={event => {
                    event.stopPropagation()
                    openAddAddress()
                  }}
                >
                  <Plus size={16} />
                  Add Address
                </button>
              </div>

              {activeSection === 'addresses' && (
                <>
                  {addresses.length === 0 ? (
                    <div className="customer-profile-empty">
                      <MapPin size={28} />
                      <h4>No saved addresses</h4>
                      <p>
                        Add your first delivery address for a faster checkout.
                      </p>

                      <button
                        className="customer-profile-primary-button"
                        onClick={openAddAddress}
                      >
                        <Plus size={16} />
                        Add Your First Address
                      </button>
                    </div>
                  ) : (
                    <div className="customer-profile-address-list">
                      {addresses.map(address => (
                        <article
                          className={`customer-profile-address-card ${
                            address.is_default ? 'default' : ''
                          }`}
                          key={address.id}
                        >
                          <div className="customer-profile-address-top">
                            <div className="customer-profile-address-label">
                              <span>{address.label}</span>

                              {address.is_default === 1 && (
                                <small>
                                  <Star size={12} fill="currentColor" />
                                  Default
                                </small>
                              )}
                            </div>

                            <div className="customer-profile-address-actions">
                              <button
                                onClick={() => openEditAddress(address)}
                                disabled={actionAddressId === address.id}
                                aria-label={`Edit ${address.label} address`}
                              >
                                <Pencil size={15} />
                              </button>

                              <button
                                onClick={() => void handleDeleteAddress(address)}
                                disabled={actionAddressId === address.id}
                                aria-label={`Delete ${address.label} address`}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>

                          <strong>{address.full_name}</strong>

                          <p>
                            {address.address_line1}
                            {address.address_line2
                              ? `, ${address.address_line2}`
                              : ''}
                          </p>

                          <p>
                            {address.city}, {address.state} - {address.pincode}
                          </p>

                          {address.landmark && (
                            <p>Landmark: {address.landmark}</p>
                          )}

                          <div className="customer-profile-address-footer">
                            <span>
                              {address.phone}
                            </span>

                            {!address.is_default && (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleSetDefault(address.id)
                                }
                                disabled={actionAddressId === address.id}
                              >
                                Set as default
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>

          </div>
        )}

        {addressFormOpen && (
          <div
            className="customer-profile-address-modal-overlay"
            onClick={closeAddressForm}
          >
            <div
              className="customer-profile-address-modal"
              onClick={event => event.stopPropagation()}
            >
              <div className="customer-profile-address-modal-header">
                <div>
                  <span className="customer-profile-eyebrow">
                    DELIVERY ADDRESS
                  </span>
                  <h3>
                    {editingAddressId
                      ? 'Edit Address'
                      : 'Add New Address'}
                  </h3>
                </div>

                <button
                  className="customer-profile-icon-button"
                  onClick={closeAddressForm}
                  aria-label="Close address form"
                >
                  <X size={20} />
                </button>
              </div>

              <form
                className="customer-profile-address-form"
                onSubmit={handleAddressSave}
              >
                <label>
                  <span>Address Label</span>
                  <select
                    value={addressForm.label}
                    onChange={event =>
                      setAddressForm({
                        ...addressForm,
                        label: event.target.value
                      })
                    }
                  >
                    <option value="Home">Home</option>
                    <option value="Office">Office</option>
                    <option value="Other">Other</option>
                  </select>
                </label>

                <div className="customer-profile-two-column">
                  <label>
                    <span>Full Name</span>
                    <input
                      value={addressForm.fullName}
                      onChange={event =>
                        setAddressForm({
                          ...addressForm,
                          fullName: event.target.value
                        })
                      }
                      required
                    />
                  </label>

                  <label>
                    <span>Phone</span>
                    <input
                      value={addressForm.phone}
                      onChange={event =>
                        setAddressForm({
                          ...addressForm,
                          phone: event.target.value
                        })
                      }
                      required
                    />
                  </label>
                </div>

                <label>
                  <span>Address Line 1</span>
                  <input
                    value={addressForm.addressLine1}
                    onChange={event =>
                      setAddressForm({
                        ...addressForm,
                        addressLine1: event.target.value
                      })
                    }
                    placeholder="House / building / street"
                    required
                  />
                </label>

                <label>
                  <span>Address Line 2 <em>Optional</em></span>
                  <input
                    value={addressForm.addressLine2}
                    onChange={event =>
                      setAddressForm({
                        ...addressForm,
                        addressLine2: event.target.value
                      })
                    }
                    placeholder="Area / locality"
                  />
                </label>

                <div className="customer-profile-two-column">
                  <label>
                    <span>City</span>
                    <input
                      value={addressForm.city}
                      onChange={event =>
                        setAddressForm({
                          ...addressForm,
                          city: event.target.value
                        })
                      }
                      required
                    />
                  </label>

                  <label>
                    <span>State</span>
                    <input
                      value={addressForm.state}
                      onChange={event =>
                        setAddressForm({
                          ...addressForm,
                          state: event.target.value
                        })
                      }
                      required
                    />
                  </label>
                </div>

                <div className="customer-profile-two-column">
                  <label>
                    <span>Pincode</span>
                    <input
                      value={addressForm.pincode}
                      onChange={event =>
                        setAddressForm({
                          ...addressForm,
                          pincode: event.target.value
                        })
                      }
                      inputMode="numeric"
                      maxLength={6}
                      required
                    />
                  </label>

                  <label>
                    <span>Landmark <em>Optional</em></span>
                    <input
                      value={addressForm.landmark}
                      onChange={event =>
                        setAddressForm({
                          ...addressForm,
                          landmark: event.target.value
                        })
                      }
                    />
                  </label>
                </div>

                <div className="customer-profile-address-form-actions">
                  <button
                    type="button"
                    className="customer-profile-secondary-button"
                    onClick={closeAddressForm}
                    disabled={savingAddress}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="customer-profile-primary-button"
                    disabled={savingAddress}
                  >
                    {savingAddress ? (
                      <>
                        <RefreshCw
                          size={16}
                          className="customer-profile-spin"
                        />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        {editingAddressId
                          ? 'Update Address'
                          : 'Save Address'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default CustomerProfile

