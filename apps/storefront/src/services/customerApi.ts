const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const TOKEN_KEY = 'riya-customer-token'

export type Customer = {
  id: number
  name: string
  email: string
  phone: string
}

export type AuthResponse = {
  success: boolean
  message: string
  data: {
    token: string
    customer: Customer
  }
}

export type RegisterResponse = {
  success: boolean
  message: string
  data: {
    requiresEmailVerification: boolean
    customerId: number
    email: string
  }
}

export type VerifyEmailOtpResponse = {
  success: boolean
  message: string
  data: {
    token: string
    customer: Customer
  }
}

export type CustomerOrderItem = {
  id?: number
  product_id: number
  product_name: string
  sku: string | null
  quantity: number
  unit_price: number
  line_total: number
}

export type OrderEvent = {
  old_status: string | null
  new_status: string
  note: string
  created_at: string
}

export type CustomerOrder = {
  id: number
  order_number: string
  subtotal: number
  delivery_fee: number
  discount: number
  total_amount: number
  payment_method: string
  payment_status: string
  status: string
  created_at: string
  updated_at?: string
  delivery_address?: string
  delivery_city?: string
  delivery_state?: string
  delivery_pincode?: string
  customer_notes?: string
  cancellation_reason?: string
  items?: CustomerOrderItem[]
  events?: OrderEvent[]
}

export type CustomerProfile = {
  id: number
  customer_id: number
  date_of_birth: string
  gender: string
  avatar_url: string
  language: string
  currency: string
  created_at: string
  updated_at: string
  name: string
  email: string
  phone: string
}

export type CustomerAddress = {
  id: number
  customer_id: number
  label: string
  full_name: string
  phone: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  pincode: string
  landmark: string
  is_default: number
  created_at: string
  updated_at: string
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

function saveSession(token: string, customer: Customer) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem('riya-customer', JSON.stringify(customer))
}

export function getCustomerSession() {
  const token = getToken()
  const rawCustomer = localStorage.getItem('riya-customer')

  if (!token || !rawCustomer) return null

  try {
    return {
      token,
      customer: JSON.parse(rawCustomer) as Customer
    }
  } catch {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem('riya-customer')
    return null
  }
}

export function clearCustomerSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem('riya-customer')
}

async function customerRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  authenticated = true
): Promise<T> {
  const token = getToken()

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authenticated && token
        ? { Authorization: `Bearer ${token}` }
        : {}),
      ...options.headers
    }
  })

  const result = await response.json().catch(() => null)

  if (!response.ok || result?.success === false) {
    if (response.status === 401 && authenticated) {
      clearCustomerSession()
    }

    throw new Error(
      result?.message || `Request failed (${response.status})`
    )
  }

  return result as T
}

export async function registerCustomer(input: {
  name: string
  email: string
  phone: string
  password: string
}) {
  const result = await customerRequest<RegisterResponse>(
    '/customer/auth/register',
    {
      method: 'POST',
      body: JSON.stringify(input)
    },
    false
  )

  return result.data
}

export async function verifyCustomerEmailOtp(input: {
  customerId: number
  otp: string
}) {
  const result = await customerRequest<VerifyEmailOtpResponse>(
    '/customer/auth/register/verify-otp',
    {
      method: 'POST',
      body: JSON.stringify(input)
    },
    false
  )

  saveSession(result.data.token, result.data.customer)
  return result.data.customer
}

export async function resendCustomerEmailOtp(customerId: number) {
  const result = await customerRequest<{
    success: boolean
    message: string
    data: {
      customerId: number
      email: string
    }
  }>(
    '/customer/auth/register/resend-otp',
    {
      method: 'POST',
      body: JSON.stringify({ customerId })
    },
    false
  )

  return result.data
}

export async function loginCustomer(input: {
  email: string
  password: string
}) {
  const result = await customerRequest<AuthResponse>(
    '/customer/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(input)
    },
    false
  )

  saveSession(result.data.token, result.data.customer)
  return result.data.customer
}

export async function fetchCustomerProfile() {
  const result = await customerRequest<{
    success: boolean
    data: { customer: Customer }
  }>('/customer/auth/me')

  localStorage.setItem(
    'riya-customer',
    JSON.stringify(result.data.customer)
  )

  return result.data.customer
}

export async function fetchCustomerAccountProfile() {
  const result = await customerRequest<{
    success: boolean
    data: {
      profile: CustomerProfile
    }
  }>('/customer/profile')

  const profile = result.data.profile

  localStorage.setItem(
    'riya-customer',
    JSON.stringify({
      id: profile.id ? profile.customer_id : profile.customer_id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone
    })
  )

  return profile
}

export async function changeCustomerPassword(
  currentPassword: string,
  newPassword: string
) {
  return customerRequest<{ success: boolean; message: string }>(
    '/customer/auth/password',
    {
      method: 'PATCH',
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    }
  )
}

export async function updateCustomerAccountProfile(input: {
  name: string
  email: string
  phone: string
  dateOfBirth: string
  gender: string
  language: string
  currency: string
}) {
  const result = await customerRequest<{
    success: boolean
    message: string
    data: {
      profile: CustomerProfile
    }
  }>('/customer/profile', {
    method: 'PATCH',
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      phone: input.phone,
      date_of_birth: input.dateOfBirth,
      gender: input.gender,
      language: input.language,
      currency: input.currency
    })
  })

  const profile = result.data.profile

  localStorage.setItem(
    'riya-customer',
    JSON.stringify({
      id: profile.customer_id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone
    })
  )

  return profile
}

export async function fetchCustomerAddresses() {
  const result = await customerRequest<{
    success: boolean
    data: {
      addresses: CustomerAddress[]
    }
  }>('/customer/profile/addresses')

  return result.data.addresses
}

export async function createCustomerAddress(input: {
  label: string
  fullName: string
  phone: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  pincode: string
  landmark: string
}) {
  const result = await customerRequest<{
    success: boolean
    data: {
      address: CustomerAddress
    }
  }>('/customer/profile/addresses', {
    method: 'POST',
    body: JSON.stringify({
      label: input.label,
      full_name: input.fullName,
      phone: input.phone,
      address_line1: input.addressLine1,
      address_line2: input.addressLine2,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      landmark: input.landmark
    })
  })

  return result.data.address
}

export async function updateCustomerAddress(
  id: number,
  input: {
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
) {
  const result = await customerRequest<{
    success: boolean
    data: {
      address: CustomerAddress
    }
  }>(`/customer/profile/addresses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      label: input.label,
      full_name: input.fullName,
      phone: input.phone,
      address_line1: input.addressLine1,
      address_line2: input.addressLine2,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      landmark: input.landmark
    })
  })

  return result.data.address
}

export async function deleteCustomerAddress(id: number) {
  return customerRequest<{
    success: boolean
    message: string
  }>(`/customer/profile/addresses/${id}`, {
    method: 'DELETE'
  })
}

export async function setCustomerAddressDefault(id: number) {
  const result = await customerRequest<{
    success: boolean
    data: {
      address: CustomerAddress
    }
  }>(`/customer/profile/addresses/${id}/default`, {
    method: 'PATCH'
  })

  return result.data.address
}

export async function placeCustomerOrder(input: {
  items: { product_id: number; quantity: number }[]
  delivery_address: string
  delivery_city: string
  delivery_state: string
  delivery_pincode: string
  customer_notes?: string
}) {
  return customerRequest<{
    success: boolean
    message: string
    order: CustomerOrder
  }>('/customer/orders', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      payment_method: 'COD'
    })
  })
}

export async function fetchCustomerOrders() {
  const result = await customerRequest<{
    success: boolean
    data: {
      orders: CustomerOrder[]
    }
  }>('/customer/orders')

  return result.data.orders
}

export async function fetchCustomerOrder(id: number) {
  const result = await customerRequest<{
    success: boolean
    data: {
      order: CustomerOrder
    }
  }>(`/customer/orders/${id}`)

  return result.data.order
}

export async function cancelCustomerOrder(id: number, reason: string) {
  return customerRequest<{
    success: boolean
    message: string
  }>(`/customer/orders/${id}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ reason })
  })
}



