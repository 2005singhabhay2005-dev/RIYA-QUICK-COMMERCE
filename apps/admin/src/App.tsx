import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  Boxes,
  Check,
  CircleAlert,
  ClipboardList,
  Eye,
  EyeOff,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Truck,
  MapPin,
  Phone,
  Warehouse,
  Users,
  
  X,
} from 'lucide-react';
import HomepageCms from './HomepageCms';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

type Admin = {
  id: number;
  email: string;
  role: string;
};

type Product = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  categoryId: number;
  category?: string;
  price: number;
  originalPrice: number | null;
  stock: number;
  imageUrl: string | null;
  sku: string | null;
  isActive: number | boolean;
  createdAt?: string;
  updatedAt?: string;
};
type ProductImage = {
  id: number;
  imageUrl: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
};

type ProductSpecification = {
  id: number;
  name: string;
  value: string;
  sortOrder: number;
};

type ProductReview = {
  id: number;
  customerName: string;
  customerEmail: string;
  rating: number;
  title: string | null;
  reviewText: string;
  status: string;
  adminReply: string | null;
  createdAt: string;
};

type RecommendedProduct = {
  id: number;
  name: string;
  slug: string;
  price: number;
  originalPrice: number | null;
  imageUrl: string | null;
  stock: number;
  description: string | null;
};

type ProductDetails = {
  product: Product;
  images: ProductImage[];
  specifications: ProductSpecification[];
  reviews: ProductReview[];
  rating: {
    averageRating: number;
    reviewCount: number;
  };
  recommendations: RecommendedProduct[];
};

type Category = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  productCount: number;
};

type InventoryLog = {
  id: number;
  productId: number;
  productName: string;
  sku: string | null;
  changeAmount: number;
  previousStock: number;
  newStock: number;
  reason: string;
  createdAt: string;
};

type AuditLog = {
  id: number;
  action: string;
  entityType: string;
  entityId: number | null;
  details: string | null;
  createdAt: string;
  adminEmail: string;
};
type Order = {
  id: number;
  order_number: string;
  customer_name: string;
  customer_email?: string;
  customer_phone: string;
  delivery_city?: string;
  delivery_state?: string;
  delivery_pincode?: string;
  delivery_address?: string;
  subtotal?: number;
  delivery_fee?: number;
  discount?: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  status: string;
  customer_notes?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at?: string;
  item_count?: number;
};

type OrderItem = {
  id: number;
  product_name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type OrderEvent = {
  id: number;
  old_status: string;
  new_status: string;
  note?: string;
  created_at: string;
  changed_by_email?: string;
};

type OrderDetails = Order & {
  items: OrderItem[];
  events: OrderEvent[];
};

type OrdersResponse = {
  success: boolean;
  data: Order[];
  pagination?: { page: number; limit: number; total: number; pages: number };
};

type Dashboard = {
  products: {
    total: number;
    active: number;
    lowStock: number;
    outOfStock: number;
  };
  categories: number;
  recentLogs: InventoryLog[];
};

type ApiResult<T> = {
  success: boolean;
  data: T;
  message?: string;
  total?: number;
};

type Page =
  | 'dashboard'
  | 'homepage'
  | 'products'
  | 'categories'
  | 'inventory'
  | 'orders'
  | 'audit'
  | 'riders'
  | 'customers';

type Customer = {
  id: number;
  name: string;
  email: string;
  phone: string;
  is_active: number | boolean;
  session_version: number;
  created_at: string;
  updated_at?: string;
  order_count?: number;
};

type CustomerProfile = {
  id: number;
  customer_id: number;
  date_of_birth: string;
  gender: string;
  avatar_url: string;
  language: string;
  currency: string;
  created_at: string;
  updated_at: string;
};

type CustomerAddress = {
  id: number;
  label: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
  is_default: number | boolean;
  created_at: string;
  updated_at: string;
};

type CustomerOrderSummary = {
  total_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  total_spent: number;
};

type CustomerDetails = {
  customer: Customer;
  profile: CustomerProfile | null;
  addresses: CustomerAddress[];
  orderSummary: CustomerOrderSummary;
  orders: CustomerOrder[];
};
type CustomerOrder = {
  id: number;
  order_number: string;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  status: string;
  delivery_address: string;
  delivery_city: string;
  delivery_state: string;
  delivery_pincode: string;
  customer_notes: string;
  cancellation_reason: string;
  assigned_rider_id: number | null;
  created_at: string;
  updated_at: string;
};

type CustomersResponse = {
  success: boolean;
  data: {
    customers: Customer[];
  };
};

type CustomerDetailsResponse = {
  success: boolean;
  data: CustomerDetails;
};

type Rider = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  is_active: number | boolean;
  created_at?: string;
  updated_at?: string;
  assigned_orders?: number;
  active_deliveries?: number;
};

type RiderForm = {
  name: string;
  phone: string;
  email: string;
  password: string;
};

type ProductForm = {
  name: string;
  description: string;
  categoryId: string;
  price: string;
  originalPrice: string;
  stock: string;
  sku: string;
  imageUrl: string;
};

type CategoryForm = {
  name: string;
  description: string;
};

const emptyProductForm: ProductForm = {
  name: '',
  description: '',
  categoryId: '',
  price: '',
  originalPrice: '',
  stock: '0',
  sku: '',
  imageUrl: '',
};

const emptyCategoryForm: CategoryForm = {
  name: '',
  description: '',
};

async function apiRequest<T>(
  endpoint: string,
  token?: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  // FormData uploads need the browser-generated multipart boundary.
  // All existing JSON requests continue using application/json.
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result.message || result.error || `Request failed (${response.status})`,
    );
  }

  return result as T;
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value: string | undefined) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function isActiveProduct(product: Product) {
  return product.isActive === true || product.isActive === 1;
}

function App() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem('riya_admin_token') || '',
  );

  const [admin, setAdmin] = useState<Admin | null>(null);
  const [page, setPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersSearch, setOrdersSearch] = useState('');
  const [ordersStatusFilter, setOrdersStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<OrderDetails | null>(null);
  const [orderNote, setOrderNote] = useState('');
  const [updatingOrder, setUpdatingOrder] = useState(false);
  const [selectedRiderId, setSelectedRiderId] = useState('');
  const [assigningOrder, setAssigningOrder] = useState(false);

  const [riders, setRiders] = useState<Rider[]>([]);
  const [riderModalOpen, setRiderModalOpen] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersSearch, setCustomersSearch] = useState('');
  const [customersStatusFilter, setCustomersStatusFilter] = useState('all');
const [selectedCustomer, setSelectedCustomer] =
  useState<CustomerDetails | null>(null);
  const [loadingCustomerDetails, setLoadingCustomerDetails] = useState(false);
  const [editingRider, setEditingRider] = useState<Rider | null>(null);
  const [savingRider, setSavingRider] = useState(false);
  const [riderForm, setRiderForm] = useState<RiderForm>({
    name: '',
    phone: '',
    email: '',
    password: '',
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] =
    useState<ProductForm>(emptyProductForm);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productDetails, setProductDetails] = useState<ProductDetails | null>(null);
const [loadingProductDetails, setLoadingProductDetails] = useState(false);
const [savingProductDetails, setSavingProductDetails] = useState(false);
const [specificationRows, setSpecificationRows] = useState<
  { name: string; value: string }[]
>([]);
const [selectedRecommendationIds, setSelectedRecommendationIds] =
  useState<number[]>([]);
const [selectedProductImages, setSelectedProductImages] = useState<File[]>([]);
const [uploadingProductImages, setUploadingProductImages] = useState(false);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] =
    useState<CategoryForm>(emptyCategoryForm);
  const [savingCategory, setSavingCategory] = useState(false);

  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockValue, setStockValue] = useState('');
  const [stockReason, setStockReason] = useState('Stock update');
  const [savingStock, setSavingStock] = useState(false);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const loadDashboard = useCallback(async () => {
    const result = await apiRequest<ApiResult<Dashboard>>(
      '/admin/dashboard',
      token,
    );
    setDashboard(result.data);
  }, [token]);

  const loadProducts = useCallback(async () => {
    const params = new URLSearchParams({
      search,
      status: statusFilter,
      page: '1',
      limit: '100',
    });

    const result = await apiRequest<ApiResult<Product[]>>(
      `/admin/products?${params.toString()}`,
      token,
    );

    setProducts(Array.isArray(result.data) ? result.data : []);
  }, [token, search, statusFilter]);

  const loadCategories = useCallback(async () => {
    const result = await apiRequest<ApiResult<Category[]>>(
      '/admin/categories',
      token,
    );

    setCategories(Array.isArray(result.data) ? result.data : []);
  }, [token]);

  const loadInventoryLogs = useCallback(async () => {
    const result = await apiRequest<ApiResult<InventoryLog[]>>(
      '/admin/inventory/logs?limit=100',
      token,
    );

    setInventoryLogs(Array.isArray(result.data) ? result.data : []);
  }, [token]);

  const loadAuditLogs = useCallback(async () => {
    const result = await apiRequest<ApiResult<AuditLog[]>>(
      '/admin/audit-logs?limit=100',
      token,
    );

    setAuditLogs(Array.isArray(result.data) ? result.data : []);
  }, [token]);

  const loadOrders = useCallback(async () => {
    const params = new URLSearchParams({
      search: ordersSearch.trim(),
      status: ordersStatusFilter,
      page: '1',
      limit: '100',
    });
    const result = await apiRequest<OrdersResponse>(
      `/admin/orders?${params.toString()}`,
      token,
    );
    setOrders(Array.isArray(result.data) ? result.data : []);
    setOrdersTotal(result.pagination?.total ?? result.data?.length ?? 0);
  }, [token, ordersSearch, ordersStatusFilter]);

  const loadRiders = useCallback(async () => {
    const result = await apiRequest<ApiResult<Rider[]>>(
      '/admin/riders',
      token,
    );

    setRiders(Array.isArray(result.data) ? result.data : []);
  }, [token]);
  const loadCustomers = useCallback(async () => {
  try {
    setLoading(true);

    const params = new URLSearchParams();

    if (customersSearch.trim()) {
      params.set('search', customersSearch.trim());
    }

    if (customersStatusFilter !== 'all') {
      params.set('status', customersStatusFilter);
    }

    const query = params.toString();
    const endpoint = query
      ? `/admin/customers?${query}`
      : '/admin/customers';

    const result = await apiRequest<CustomersResponse>(endpoint, token);

    setCustomers(result.data.customers);
  } catch (err) {
    setError(
      err instanceof Error ? err.message : 'Unable to load customers',
    );
  } finally {
    setLoading(false);
  }
}, [customersSearch, customersStatusFilter, token]);

const loadCustomerDetails = useCallback(
  async (customerId: number) => {
    try {
      setLoadingCustomerDetails(true);
      setError('');

      const result = await apiRequest<CustomerDetailsResponse>(
        `/admin/customers/${customerId}`,
        token,
      );

      setSelectedCustomer(result.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load customer details',
      );
    } finally {
      setLoadingCustomerDetails(false);
    }
  },
  [token],
);
async function openOrderDetails(order: Pick<Order, 'id'>) {
  
    clearMessages();
    setOrderNote('');
    try {
      const result = await apiRequest<ApiResult<OrderDetails>>(
        `/admin/orders/${order.id}`,
        token,
      );
      setSelectedOrder(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load order details.');
    }
  }

  async function updateOrderStatus(nextStatus: string) {
    if (!selectedOrder || updatingOrder) return;
    if (nextStatus === 'Cancelled' && !orderNote.trim()) {
      setError('Please enter a cancellation reason.');
      return;
    }
    setUpdatingOrder(true);
    clearMessages();
    try {
      await apiRequest(`/admin/orders/${selectedOrder.id}/status`, token, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
          note: orderNote.trim(),
          cancellation_reason: nextStatus === 'Cancelled' ? orderNote.trim() : '',
        }),
      });
      setSuccess(`Order ${selectedOrder.order_number} updated to ${nextStatus}.`);
      setSelectedOrder(null);
      setOrderNote('');
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update order status.');
    } finally {
      setUpdatingOrder(false);
    }
  }

  function openNewRiderModal() {
    setEditingRider(null);
    setRiderForm({ name: '', phone: '', email: '', password: '' });
    setRiderModalOpen(true);
    clearMessages();
  }

  function openEditRiderModal(rider: Rider) {
    setEditingRider(rider);
    setRiderForm({
      name: rider.name,
      phone: rider.phone,
      email: rider.email || '',
      password: '',
    });
    setRiderModalOpen(true);
    clearMessages();
  }

  async function saveRider(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRider) return;

    setSavingRider(true);
    clearMessages();

    try {
      const payload: Record<string, unknown> = {
        name: riderForm.name.trim(),
        phone: riderForm.phone.trim(),
        email: riderForm.email.trim() || null,
      };

      if (riderForm.password.trim()) {
        payload.password = riderForm.password;
      }

      if (editingRider) {
        await apiRequest(
          `/admin/riders/${editingRider.id}`,
          token,
          {
            method: 'PATCH',
            body: JSON.stringify({
              ...payload,
              is_active: editingRider.is_active,
            }),
          },
        );
        setSuccess('Rider details updated successfully.');
      } else {
        if (!riderForm.password.trim()) {
          setError('Please enter a password for the new rider.');
          return;
        }

        await apiRequest('/admin/riders', token, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess('New rider created successfully.');
      }

      setRiderModalOpen(false);
      await loadRiders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save rider.');
    } finally {
      setSavingRider(false);
    }
  }

  async function deactivateRider(rider: Rider) {
    if (!window.confirm(`Deactivate rider ${rider.name}? They will no longer be able to log in.`)) {
      return;
    }

    clearMessages();

    try {
      await apiRequest(
        `/admin/riders/${rider.id}/deactivate`,
        token,
        { method: 'PATCH' },
      );
      setSuccess(`${rider.name} has been deactivated.`);
      await loadRiders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to deactivate rider.');
    }
  }

  useEffect(() => {
    if (selectedOrder?.status === 'Ready for Dispatch') {
      setSelectedRiderId('');
      void loadRiders();
    }
  }, [selectedOrder?.id, selectedOrder?.status, loadRiders]);

  async function assignOrderToRider() {
    if (!selectedOrder || !selectedRiderId || assigningOrder) return;

    setAssigningOrder(true);
    clearMessages();

    try {
      await apiRequest(
        `/admin/orders/${selectedOrder.id}/assign-rider`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({ rider_id: Number(selectedRiderId) }),
        },
      );

      setSuccess('Order assigned successfully. Status is now Out for Delivery.');
      setSelectedOrder(null);
      setSelectedRiderId('');
      await loadOrders();
      await loadRiders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to assign rider.');
    } finally {
      setAssigningOrder(false);
    }
  }
  const loadCurrentPage = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      if (page === 'dashboard') {
        await loadDashboard();
      } else if (page === 'products') {
        await Promise.all([loadProducts(), loadCategories()]);
      } else if (page === 'categories') {
        await loadCategories();
      } else if (page === 'inventory') {
        await Promise.all([loadInventoryLogs(), loadProducts()]);
      } else if (page === 'orders') {
        await loadOrders();
      } else if (page === 'riders') {
        await loadRiders();
       }
        else if (page === 'customers') {
  await loadCustomers();
}
        else if (page === 'audit') {
        await loadAuditLogs();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load admin data.',
      );
    } finally {
      setLoading(false);
    }
  }, [
    token,
    page,
    loadDashboard,
    loadProducts,
    loadCategories,
    loadInventoryLogs,
    loadOrders,
    loadRiders,
    loadAuditLogs,
    loadCustomers,
  ]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    apiRequest<ApiResult<Admin>>('/admin/me', token)
      .then((result) => {
        if (!cancelled) setAdmin(result.data);
      })
      .catch(() => {
        if (!cancelled) {
          sessionStorage.removeItem('riya_admin_token');
          setToken('');
          setAdmin(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (token && admin) {
      void loadCurrentPage();
    }
  }, [token, admin, loadCurrentPage]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    setLoginLoading(true);

    try {
      const result = await apiRequest<
        ApiResult<{ token: string; admin: Admin }>
      >('/admin/login', undefined, {
        method: 'POST',
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });

      sessionStorage.setItem('riya_admin_token', result.data.token);
      setToken(result.data.token);
      setAdmin(result.data.admin);
      setLoginPassword('');
      setSuccess('Login successful.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('riya_admin_token');
    setToken('');
    setAdmin(null);
    setDashboard(null);
    setProducts([]);
    setCategories([]);
    setInventoryLogs([]);
    setAuditLogs([]);
    setOrders([]);
    setOrdersTotal(0);
    setSelectedOrder(null);
    setPage('dashboard');
    clearMessages();
  }

  function navigate(nextPage: Page) {
    setPage(nextPage);
    setSidebarOpen(false);
    clearMessages();
  }

  function openAddProduct() {
    setEditingProduct(null);
    setProductForm(emptyProductForm);
    setProductModalOpen(true);
    clearMessages();
  }

  
async function openEditProduct(product: Product) {
  setEditingProduct(product);
  setProductForm({
    name: product.name,
    description: product.description || '',
    categoryId: String(product.categoryId),
    price: String(product.price),
    originalPrice:
      product.originalPrice === null ? '' : String(product.originalPrice),
    stock: String(product.stock),
    sku: product.sku || '',
    imageUrl: product.imageUrl || '',
  });

  setProductDetails(null);
  setLoadingProductDetails(true);
  setProductModalOpen(true);
  clearMessages();

  try {
    const response = await apiRequest<ApiResult<ProductDetails>>(
      `/products/${product.id}/details`,
      token,
    );

    const reviewsResponse = await apiRequest<ApiResult<ProductReview[]>>(
  `/admin/product-details/${product.id}/reviews`,
  token,
);

setProductDetails({
  ...response.data,
  reviews: reviewsResponse.data,
});
    setSelectedRecommendationIds(
  response.data.recommendations.map((item) => item.id),
);
    setSpecificationRows(
  response.data.specifications.map((spec) => ({
    name: spec.name,
    value: spec.value,
  })),
);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : 'Unable to load product details.',
    );
  } finally {
    setLoadingProductDetails(false);
  }
}



async function uploadProductImages() {
  if (!editingProduct || selectedProductImages.length === 0) {
    setError('Please select at least one product image.');
    return;
  }

  const formData = new FormData();

  selectedProductImages.forEach((file) => {
    formData.append('images', file);
  });

  setUploadingProductImages(true);
  clearMessages();

  try {
    await apiRequest(
      `/admin/product-details/${editingProduct.id}/images`,
      token,
      {
        method: 'POST',
        body: formData,
      },
    );
const reviewsResponse = await apiRequest<ApiResult<ProductReview[]>>(
  `/admin/product-details/${editingProduct.id}/reviews`,
  token,
);

setProductDetails((current) =>
  current
    ? {
        ...current,
        reviews: reviewsResponse.data,
      }
    : current,
);
    setSelectedProductImages([]);
    setSuccess('Product images uploaded successfully.');
  } catch (err) {
    setError(
      err instanceof Error ? err.message : 'Unable to upload product images.',
    );
  } finally {
    setUploadingProductImages(false);
  }
}

async function saveProductSpecifications() {
  if (!editingProduct) return;

  const validSpecifications = specificationRows
    .map((spec) => ({
      name: spec.name.trim(),
      value: spec.value.trim(),
    }))
    .filter((spec) => spec.name && spec.value);

  setSavingProductDetails(true);
  clearMessages();

  try {
    await apiRequest(
      `/admin/product-details/${editingProduct.id}/specifications`,
      token,
      {
        method: 'PUT',
        body: JSON.stringify({
          specifications: validSpecifications,
        }),
      },
    );

    const response = await apiRequest<ApiResult<ProductDetails>>(
      `/products/${editingProduct.id}/details`,
      token,
    );

    setProductDetails(response.data);
    setSpecificationRows(
      response.data.specifications.map((spec) => ({
        name: spec.name,
        value: spec.value,
      })),
    );

    setSuccess('Product specifications saved successfully.');
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : 'Unable to save product specifications.',
    );
  } finally {
    setSavingProductDetails(false);
  }
}

async function saveProductRecommendations() {
  if (!editingProduct) return;

  setSavingProductDetails(true);
  clearMessages();

  try {
    await apiRequest(
      `/admin/product-details/${editingProduct.id}/recommendations`,
      token,
      {
        method: 'PUT',
        body: JSON.stringify({
          productIds: selectedRecommendationIds,
        }),
      },
    );

    const response = await apiRequest<ApiResult<ProductDetails>>(
      `/products/${editingProduct.id}/details`,
      token,
    );

    setProductDetails(response.data);

    setSelectedRecommendationIds(
      response.data.recommendations.map((item) => item.id),
    );

    setSuccess('Recommended products saved successfully.');
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : 'Unable to save recommended products.',
    );
  } finally {
    setSavingProductDetails(false);
  }
}

async function moderateProductReview(
  reviewId: number,
  status: 'approved' | 'rejected',
) {
  if (!editingProduct) return;

  setSavingProductDetails(true);
  clearMessages();

  try {
    await apiRequest(
      `/admin/product-details/reviews/${reviewId}`,
      token,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
    );

    const response = await apiRequest<ApiResult<ProductDetails>>(
      `/products/${editingProduct.id}/details`,
      token,
    );

    setProductDetails(response.data);

    setSuccess(
      status === 'approved'
        ? 'Review approved successfully.'
        : 'Review rejected successfully.',
    );
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : 'Unable to update review status.',
    );
  } finally {
    setSavingProductDetails(false);
  }
}



async function deleteProductImage(imageId: number) {
  if (!editingProduct) return;

  const confirmed = window.confirm(
    'Are you sure you want to delete this product image?',
  );

  if (!confirmed) return;

  clearMessages();

  try {
    await apiRequest(
      `/admin/product-details/images/${imageId}`,
      token,
      { method: 'DELETE' },
    );

    const response = await apiRequest<ApiResult<ProductDetails>>(
      `/products/${editingProduct.id}/details`,
      token,
    );

    setProductDetails(response.data);
    setSuccess('Product image deleted successfully.');
  } catch (err) {
    setError(
      err instanceof Error ? err.message : 'Unable to delete product image.',
    );
  }
}

  
async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();

    if (!productForm.name.trim()) {
      setError('Product name is required.');
      return;
    }

    if (!productForm.categoryId) {
      setError('Please select a category.');
      return;
    }

    const price = Number(productForm.price);
    const originalPrice =
      productForm.originalPrice.trim() === ''
        ? null
        : Number(productForm.originalPrice);
    const stock = Number(productForm.stock);

    if (!Number.isFinite(price) || price < 0) {
      setError('Enter a valid product price.');
      return;
    }

    if (
      originalPrice !== null &&
      (!Number.isFinite(originalPrice) || originalPrice < price)
    ) {
      setError('Original price must be greater than or equal to selling price.');
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setError('Stock must be a whole number greater than or equal to zero.');
      return;
    }

    const payload = {
      name: productForm.name.trim(),
      description: productForm.description.trim(),
      categoryId: Number(productForm.categoryId),
      price,
      originalPrice,
      stock,
      sku: productForm.sku.trim(),
      imageUrl: productForm.imageUrl.trim(),
    };

    setSavingProduct(true);

    try {
      if (editingProduct) {
        await apiRequest(
          `/admin/products/${editingProduct.id}`,
          token,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          },
        );

        setSuccess('Product updated successfully.');
      } else {
        await apiRequest('/admin/products', token, {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        setSuccess('Product created successfully.');
      }

      setProductModalOpen(false);
      await Promise.all([loadProducts(), loadDashboard()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save product.');
    } finally {
      setSavingProduct(false);
    }
  }

  async function toggleProductStatus(product: Product) {
    clearMessages();

    const nextStatus = !isActiveProduct(product);

    try {
      await apiRequest(`/admin/products/${product.id}/status`, token, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextStatus }),
      });

      setSuccess(
        nextStatus ? 'Product activated.' : 'Product deactivated.',
      );

      await Promise.all([loadProducts(), loadDashboard()]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update product status.',
      );
    }
  }

  function openStockModal(product: Product) {
    setStockProduct(product);
    setStockValue(String(product.stock));
    setStockReason('Stock update');
    clearMessages();
  }

  async function saveStock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!stockProduct) return;

    const newStock = Number(stockValue);

    if (!Number.isInteger(newStock) || newStock < 0) {
      setError('Enter a valid whole-number stock quantity.');
      return;
    }

    if (!stockReason.trim()) {
      setError('Please enter a stock update reason.');
      return;
    }

    setSavingStock(true);
    clearMessages();

    try {
      await apiRequest(`/admin/products/${stockProduct.id}/stock`, token, {
        method: 'PATCH',
        body: JSON.stringify({
          stock: newStock,
          reason: stockReason.trim(),
        }),
      });

      setStockProduct(null);
      setSuccess('Stock updated successfully.');

      await Promise.all([
        loadProducts(),
        loadInventoryLogs(),
        loadDashboard(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update stock.');
    } finally {
      setSavingStock(false);
    }
  }

  function openAddCategory() {
    setEditingCategory(null);
    setCategoryForm(emptyCategoryForm);
    setCategoryModalOpen(true);
    clearMessages();
  }

  function openEditCategory(category: Category) {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
    });
    setCategoryModalOpen(true);
    clearMessages();
  }

  async function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();

    if (!categoryForm.name.trim()) {
      setError('Category name is required.');
      return;
    }

    setSavingCategory(true);

    try {
      const payload = {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim(),
      };

      if (editingCategory) {
        await apiRequest(
          `/admin/categories/${editingCategory.id}`,
          token,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          },
        );

        setSuccess('Category updated successfully.');
      } else {
        await apiRequest('/admin/categories', token, {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        setSuccess('Category created successfully.');
      }

      setCategoryModalOpen(false);
      await Promise.all([loadCategories(), loadDashboard()]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save category.',
      );
    } finally {
      setSavingCategory(false);
    }
  }

  if (!token || !admin) {
    return (
      <div className="login-page">
        <div className="login-decoration login-decoration-one" />
        <div className="login-decoration login-decoration-two" />

        <div className="login-card">
          <div className="login-brand">
            <div className="login-brand-icon">
              <ShoppingBag size={27} />
            </div>
            <div>
              <h1>RIYA</h1>
              <span>QUICK COMMERCE</span>
            </div>
          </div>

          <div className="login-heading">
            <span className="eyebrow">ADMINISTRATION</span>
            <h2>Welcome back</h2>
            <p>Sign in to manage your store and operations.</p>
          </div>

          {error && (
            <div className="alert alert-error">
              <CircleAlert size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form">
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              placeholder="admin@example.com"
              autoComplete="username"
              required
            />

            <label htmlFor="login-password">Password</label>
            <div className="password-field">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>

            <button
              type="submit"
              className="primary-button login-submit"
              disabled={loginLoading}
            >
              {loginLoading ? (
                <>
                  <RefreshCw size={17} className="spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  Sign in to dashboard
                </>
              )}
            </button>
          </form>

          <div className="login-security">
            <ShieldCheck size={16} />
            <span>Protected admin access</span>
          </div>
        </div>

        <div className="login-footer">
          Â© {new Date().getFullYear()} Riya Quick Commerce
        </div>
      </div>
    );
  }

  const pageTitles: Record<Page, string> = {
    homepage: 'Homepage CMS',
    dashboard: 'Dashboard',
    products: 'Products',
    categories: 'Categories',
    inventory: 'Inventory',
    orders: 'Orders',
    riders: 'Rider Management',
    customers: 'Customers',
    audit: 'Audit logs',
  };

  return (
    <div className="admin-app">
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside className={`admin-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">
            <ShoppingBag size={23} />
          </div>
          <div>
            <strong>RIYA</strong>
            <span>QUICK COMMERCE</span>
          </div>
          <button
            className="mobile-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="sidebar-nav">
          <button
            className={page === 'dashboard' ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate('dashboard')}
          >
            <LayoutDashboard size={19} />
            <span>Dashboard</span>
          </button>

          <button
            className={page === 'homepage' ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate('homepage')}
          >
            <Monitor size={19} />
            <span>Homepage CMS</span>
          </button>
          <button
            className={page === 'products' ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate('products')}
          >
            <Package size={19} />
            <span>Products</span>
          </button>

          <button
            className={page === 'categories' ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate('categories')}
          >
            <Tag size={19} />
            <span>Categories</span>
          </button>

          <button
            className={page === 'inventory' ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate('inventory')}
          >
            <Warehouse size={19} />
            <span>Inventory</span>
          </button>

          <button
            className={page === 'orders' ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate('orders')}
          >
            <Truck size={19} />
            <span>Orders</span>
          </button>

         
            <button
  className={page === 'riders' ? 'nav-item active' : 'nav-item'}
  onClick={() => navigate('riders')}
>
  <Users size={19} />
  <span>Riders</span>
</button>

<button
  className={page === 'customers' ? 'nav-item active' : 'nav-item'}
  onClick={() => navigate('customers')}
>
  <Users size={19} />
  <span>Customers</span>
</button>
          <button
            className={page === 'audit' ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate('audit')}
          >
            <ClipboardList size={19} />
            <span>Audit logs</span>
          </button>
        </nav>

        <div className="sidebar-label sidebar-label-bottom">STORE</div>

        <div className="sidebar-store-card">
          <div className="store-card-icon">
            <Activity size={18} />
          </div>
          <div>
            <strong>Store system</strong>
            <span>Admin connected</span>
          </div>
          <span className="online-dot" />
        </div>

        <div className="sidebar-user">
          <div className="user-avatar">
            {(admin.email || 'A').charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <strong>Administrator</strong>
            <span>{admin.email}</span>
          </div>
          <button
            className="logout-icon"
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <div>
              <div className="breadcrumb">Riya Store / {pageTitles[page]}</div>
              <h1>{pageTitles[page]}</h1>
            </div>
          </div>

          <div className="topbar-actions">
            <span className="admin-status">
              <span className="online-dot" />
              System online
            </span>
            <button
              className="icon-button"
              onClick={() => void loadCurrentPage()}
              title="Refresh data"
              aria-label="Refresh data"
              disabled={loading}
            >
              <RefreshCw size={18} className={loading ? 'spin' : ''} />
            </button>
            <div className="topbar-avatar">
              {(admin.email || 'A').charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="admin-content">
          {error && (
            <div className="alert alert-error">
              <CircleAlert size={18} />
              <span>{error}</span>
              <button onClick={() => setError('')} aria-label="Dismiss error">
                <X size={17} />
              </button>
            </div>
          )}

          {success && (
            <div className="alert alert-success">
              <Check size={18} />
              <span>{success}</span>
              <button
                onClick={() => setSuccess('')}
                aria-label="Dismiss message"
              >
                <X size={17} />
              </button>
            </div>
          )}

          {loading && (
            <div className="loading-line">
              <RefreshCw size={17} className="spin" />
              Loading data...
            </div>
          )}

          {page === 'dashboard' && (
            <section className="page-section">
              <div className="welcome-row">
                <div>
                  <span className="eyebrow">STORE OVERVIEW</span>
                  <h2>Good to see you, Admin</h2>
                  <p>Here is what is happening with your store today.</p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => void loadDashboard()}
                >
                  <RefreshCw size={16} />
                  Refresh overview
                </button>
              </div>

              <div className="stats-grid">
                <StatCard
                  title="Total products"
                  value={dashboard?.products.total ?? 0}
                  icon={<Package size={21} />}
                  tone="green"
                  description="Products in your catalogue"
                />
                <StatCard
                  title="Active products"
                  value={dashboard?.products.active ?? 0}
                  icon={<Check size={21} />}
                  tone="blue"
                  description="Visible products"
                />
                <StatCard
                  title="Low stock"
                  value={dashboard?.products.lowStock ?? 0}
                  icon={<AlertTriangle size={21} />}
                  tone="orange"
                  description="Products needing attention"
                />
                <StatCard
                  title="Out of stock"
                  value={dashboard?.products.outOfStock ?? 0}
                  icon={<Archive size={21} />}
                  tone="red"
                  description="Products with zero stock"
                />
              </div>

              <div className="dashboard-grid">
                <div className="panel quick-actions-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Quick actions</h3>
                      <p>Manage your store efficiently</p>
                    </div>
                  </div>

                  <div className="quick-actions">
                    <button
                      className="quick-action"
                      onClick={() => {
                        navigate('products');
                        openAddProduct();
                      }}
                    >
                      <span className="quick-action-icon green">
                        <Plus size={20} />
                      </span>
                      <span>
                        <strong>Add product</strong>
                        <small>Create a new catalogue item</small>
                      </span>
                    </button>

                    <button
                      className="quick-action"
                      onClick={() => navigate('products')}
                    >
                      <span className="quick-action-icon blue">
                        <Package size={20} />
                      </span>
                      <span>
                        <strong>Manage products</strong>
                        <small>Edit prices and product details</small>
                      </span>
                    </button>

                    <button
                      className="quick-action"
                      onClick={() => navigate('categories')}
                    >
                      <span className="quick-action-icon purple">
                        <Tag size={20} />
                      </span>
                      <span>
                        <strong>Manage categories</strong>
                        <small>Organise your catalogue</small>
                      </span>
                    </button>

                    <button
                      className="quick-action"
                      onClick={() => navigate('inventory')}
                    >
                      <span className="quick-action-icon orange">
                        <Boxes size={20} />
                      </span>
                      <span>
                        <strong>Update inventory</strong>
                        <small>Review stock movement</small>
                      </span>
                    </button>
                  </div>
                </div>

                <div className="panel category-summary-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Catalogue summary</h3>
                      <p>Your store at a glance</p>
                    </div>
                    <Tag size={20} />
                  </div>

                  <div className="summary-number">
                    {dashboard?.categories ?? categories.length}
                  </div>
                  <div className="summary-caption">Total categories</div>

                  <div className="summary-divider" />

                  <div className="summary-row">
                    <span>Active products</span>
                    <strong>{dashboard?.products.active ?? 0}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Low stock products</span>
                    <strong>{dashboard?.products.lowStock ?? 0}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Out of stock products</span>
                    <strong>{dashboard?.products.outOfStock ?? 0}</strong>
                  </div>

                  <button
                    className="text-link"
                    onClick={() => navigate('products')}
                  >
                    View products <ArrowUp size={15} />
                  </button>
                </div>
              </div>

              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Recent inventory activity</h3>
                    <p>Latest stock changes in your store</p>
                  </div>
                  <button
                    className="text-link"
                    onClick={() => navigate('inventory')}
                  >
                    View all <ArrowUp size={15} />
                  </button>
                </div>

                <InventoryTable
                  logs={dashboard?.recentLogs ?? []}
                  compact
                />
              </div>
            </section>
          )}

          {page === 'products' && (
            <section className="page-section">
              <div className="section-toolbar">
                <div>
                  <h2>Product catalogue</h2>
                  <p>Manage product details, prices and availability.</p>
                </div>
                <button className="primary-button" onClick={openAddProduct}>
                  <Plus size={18} />
                  Add product
                </button>
              </div>

              <div className="panel">
                <div className="table-toolbar">
                  <div className="search-box">
                    <Search size={18} />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search products by name or SKU..."
                    />
                  </div>

                  <select
                    className="filter-select"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    aria-label="Filter products by status"
                  >
                    <option value="all">All products</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Stock</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={product.id}>
                          <td>
                            <div className="product-cell">
                              <div className="product-thumbnail">
                                {product.imageUrl ? (
                                  <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                  />
                                ) : (
                                  <Package size={21} />
                                )}
                              </div>
                              <div>
                                <strong>{product.name}</strong>
                                <small>#{product.id}</small>
                              </div>
                            </div>
                          </td>
                          <td>{product.sku || 'â€”'}</td>
                          <td>{product.category || 'â€”'}</td>
                          <td>
                            <strong>{formatCurrency(product.price)}</strong>
                            {product.originalPrice !== null &&
                              product.originalPrice > product.price && (
                                <small className="old-price">
                                  {formatCurrency(product.originalPrice)}
                                </small>
                              )}
                          </td>
                          <td>
                            <span
                              className={
                                product.stock === 0
                                  ? 'stock-value danger'
                                  : product.stock <= 10
                                    ? 'stock-value warning'
                                    : 'stock-value'
                              }
                            >
                              {product.stock}
                            </span>
                          </td>
                          <td>
                            <span
                              className={
                                isActiveProduct(product)
                                  ? 'status-pill status-active'
                                  : 'status-pill status-inactive'
                              }
                            >
                              {isActiveProduct(product) ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button
                                className="table-action"
                                onClick={() => openEditProduct(product)}
                                title="Edit product"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                className="table-action"
                                onClick={() => openStockModal(product)}
                                title="Update stock"
                              >
                                <Boxes size={16} />
                              </button>
                              <button
                                className="table-action"
                                onClick={() => void toggleProductStatus(product)}
                                title={
                                  isActiveProduct(product)
                                    ? 'Deactivate'
                                    : 'Activate'
                                }
                              >
                                {isActiveProduct(product) ? (
                                  <EyeOff size={16} />
                                ) : (
                                  <Check size={16} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {products.length === 0 && !loading && (
                        <tr>
                          <td colSpan={7}>
                            <EmptyState
                              title="No products found"
                              description="Try another search or add your first product."
                            />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="table-footer">
                  Showing {products.length} products
                </div>
              </div>
            </section>
          )}

          {page === 'categories' && (
            <section className="page-section">
              <div className="section-toolbar">
                <div>
                  <h2>Product categories</h2>
                  <p>Organise products into easy-to-browse groups.</p>
                </div>
                <button className="primary-button" onClick={openAddCategory}>
                  <Plus size={18} />
                  Add category
                </button>
              </div>

              <div className="category-grid">
                {categories.map((category) => (
                  <div className="category-card" key={category.id}>
                    <div className="category-card-top">
                      <div className="category-icon">
                        <Tag size={22} />
                      </div>
                      <button
                        className="table-action"
                        onClick={() => openEditCategory(category)}
                        title="Edit category"
                      >
                        <Eye size={17} />
                      </button>
                    </div>

                    <h3>{category.name}</h3>
                    <p>{category.description || 'No description added.'}</p>

                    <div className="category-card-footer">
                      <span>
                        <Package size={15} />
                        {category.productCount} products
                      </span>
                      <span className="category-id">#{category.id}</span>
                    </div>
                  </div>
                ))}

                {categories.length === 0 && !loading && (
                  <EmptyState
                    title="No categories found"
                    description="Create your first category to organise products."
                  />
                )}
              </div>
            </section>
          )}

          {page === 'inventory' && (
            <section className="page-section">
              <div className="section-toolbar">
                <div>
                  <h2>Inventory management</h2>
                  <p>Monitor stock levels and track inventory movements.</p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => {
                    void loadProducts();
                    void loadInventoryLogs();
                  }}
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>

              <div className="stats-grid inventory-stats">
                <StatCard
                  title="Total products"
                  value={products.length}
                  icon={<Package size={21} />}
                  tone="green"
                  description="Loaded catalogue products"
                />
                <StatCard
                  title="Total units"
                  value={products.reduce((sum, item) => sum + item.stock, 0)}
                  icon={<Boxes size={21} />}
                  tone="blue"
                  description="Current stock quantity"
                />
                <StatCard
                  title="Low stock"
                  value={products.filter((item) => item.stock > 0 && item.stock <= 10).length}
                  icon={<AlertTriangle size={21} />}
                  tone="orange"
                  description="10 units or fewer"
                />
                <StatCard
                  title="Out of stock"
                  value={products.filter((item) => item.stock === 0).length}
                  icon={<Archive size={21} />}
                  tone="red"
                  description="Requires replenishment"
                />
              </div>

              <div className="panel inventory-products-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Current stock</h3>
                    <p>Choose a product to adjust its inventory.</p>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Current stock</th>
                        <th>Stock status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={product.id}>
                          <td>
                            <strong>{product.name}</strong>
                          </td>
                          <td>{product.sku || 'â€”'}</td>
                          <td>
                            <strong>{product.stock}</strong>
                          </td>
                          <td>
                            <StockBadge stock={product.stock} />
                          </td>
                          <td>
                            <button
                              className="small-outline-button"
                              onClick={() => openStockModal(product)}
                            >
                              <Boxes size={15} />
                              Adjust stock
                            </button>
                          </td>
                        </tr>
                      ))}

                      {products.length === 0 && (
                        <tr>
                          <td colSpan={5}>
                            <EmptyState
                              title="No inventory"
                              description="Products will appear here when available."
                            />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Inventory movement history</h3>
                    <p>Recorded stock adjustments.</p>
                  </div>
                </div>
                <InventoryTable logs={inventoryLogs} />
              </div>
            </section>
          )}

          {page === 'orders' && (
            <section className="page-section">
              <div className="section-toolbar">
                <div>
                  <h2>Order management</h2>
                  <p>Review customer orders and manage fulfilment progress.</p>
                </div>
                <button className="secondary-button" onClick={() => void loadOrders()} disabled={loading}>
                  <RefreshCw size={16} /> Refresh orders
                </button>
              </div>

              <div className="stats-grid">
                <StatCard title="Total orders" value={ordersTotal} icon={<ShoppingBag size={21} />} tone="blue" description="Orders matching current filter" />
                <StatCard title="Placed" value={orders.filter((o) => o.status === 'Placed').length} icon={<ClipboardList size={21} />} tone="orange" description="Awaiting confirmation" />
                <StatCard title="In progress" value={orders.filter((o) => ['Confirmed', 'Packed', 'Ready for Dispatch', 'Out for Delivery'].includes(o.status)).length} icon={<Truck size={21} />} tone="green" description="Being fulfilled or delivered" />
                <StatCard title="Delivered" value={orders.filter((o) => o.status === 'Delivered').length} icon={<Check size={21} />} tone="blue" description="Successfully completed" />
              </div>

              <div className="panel">
                <div className="table-toolbar">
                  <div className="search-box">
                    <Search size={18} />
                    <input value={ordersSearch} onChange={(event) => setOrdersSearch(event.target.value)} placeholder="Search order number, customer or phone..." />
                  </div>
                  <select className="filter-select" value={ordersStatusFilter} onChange={(event) => setOrdersStatusFilter(event.target.value)} aria-label="Filter orders by status">
                    <option value="all">All statuses</option>
                    {['Placed', 'Confirmed', 'Packed', 'Ready for Dispatch', 'Out for Delivery', 'Delivered', 'Cancelled'].map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <button className="small-outline-button" onClick={() => { setOrdersSearch(''); setOrdersStatusFilter('all'); }}>Clear filters</button>
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Placed on</th><th>Action</th></tr></thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id}>
                          <td><strong>{order.order_number}</strong><small className="table-subtext">#{order.id}</small></td>
                          <td><strong>{order.customer_name}</strong><small className="table-subtext">{order.customer_phone}</small></td>
                          <td>{order.item_count ?? 'â€”'}</td>
                          <td><strong>{formatCurrency(order.total_amount)}</strong></td>
                          <td>{order.payment_method}<small className="table-subtext">{order.payment_status}</small></td>
                          <td><span className={`status-pill ${order.status === 'Delivered' ? 'status-active' : order.status === 'Cancelled' ? 'status-inactive' : 'status-warning'}`}>{order.status}</span></td>
                          <td>{formatDate(order.created_at)}</td>
                          <td><button className="small-outline-button" onClick={() => void openOrderDetails(order)}><Eye size={15} /> View</button></td>
                        </tr>
                      ))}
                      {orders.length === 0 && !loading && <tr><td colSpan={8}><EmptyState title="No orders found" description="New customer orders will appear here." /></td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="table-footer">Showing {orders.length} of {ordersTotal} orders</div>
              </div>
            </section>
          )}

          {page === 'riders' && (
            <section className="page-section">
              <div className="section-toolbar">
                <div>
                  <h2>Rider management</h2>
                  <p>Create delivery accounts and monitor your delivery team.</p>
                </div>
                <div className="toolbar-actions">
                  <button className="secondary-button" onClick={() => void loadRiders()} disabled={loading}>
                    <RefreshCw size={16} /> Refresh
                  </button>
                  <button className="primary-button" onClick={openNewRiderModal}>
                    <Plus size={16} /> Add rider
                  </button>
                </div>
              </div>

              <div className="stats-grid">
                <StatCard title="Total riders" value={riders.length} icon={<Users size={21} />} tone="blue" description="Registered delivery accounts" />
                <StatCard title="Active riders" value={riders.filter((r) => Boolean(r.is_active)).length} icon={<Check size={21} />} tone="green" description="Can log in and deliver" />
                <StatCard title="Assigned orders" value={riders.reduce((sum, r) => sum + (r.assigned_orders || 0), 0)} icon={<ShoppingBag size={21} />} tone="orange" description="Orders assigned to riders" />
                <StatCard title="Active deliveries" value={riders.reduce((sum, r) => sum + (r.active_deliveries || 0), 0)} icon={<Truck size={21} />} tone="blue" description="Currently out for delivery" />
              </div>

              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Delivery team</h3>
                    <p>Manage rider accounts and delivery workload.</p>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Rider</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>Assigned orders</th>
                        <th>Active deliveries</th>
                        <th>Account status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riders.map((rider) => (
                        <tr key={rider.id}>
                          <td>
                            <strong>{rider.name}</strong>
                            <small className="table-subtext">Rider #{rider.id}</small>
                          </td>
                          <td>{rider.phone}</td>
                          <td>{rider.email || '—'}</td>
                          <td>{rider.assigned_orders ?? 0}</td>
                          <td>{rider.active_deliveries ?? 0}</td>
                          <td>
                            <span className={`status-pill ${rider.is_active ? 'status-active' : 'status-inactive'}`}>
                              {rider.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <div className="table-actions">
                              <button className="small-outline-button" onClick={() => openEditRiderModal(rider)}>
                                <Eye size={15} /> Edit
                              </button>
                              {Boolean(rider.is_active) && (
                                <button className="small-outline-button" onClick={() => void deactivateRider(rider)}>
                                  Deactivate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {riders.length === 0 && !loading && (
                        <tr>
                          <td colSpan={7}>
                            <EmptyState title="No riders registered" description="Add your first delivery rider to start assigning orders." />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="table-footer">Showing {riders.length} registered riders</div>
              </div>
            </section>
          )}
          {page === 'customers' && (
  <section className="page-section">
    <div className="section-toolbar">
      <div>
        <h2>Customer Management</h2>
        <p>Manage customer accounts, status and account details.</p>
      </div>

      <div className="toolbar-actions">
        <button
          className="secondary-button"
          onClick={() => void loadCustomers()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
    </div>

    <div className="stats-grid">
      <StatCard
        title="Total customers"
        value={customers.length}
        icon={<Users size={21} />}
        tone="blue"
        description="Registered customer accounts"
      />

      <StatCard
        title="Active customers"
        value={customers.filter((customer) => Boolean(customer.is_active)).length}
        icon={<Check size={21} />}
        tone="green"
        description="Customers who can log in"
      />

      <StatCard
        title="Inactive customers"
        value={customers.filter((customer) => !Boolean(customer.is_active)).length}
        icon={<CircleAlert size={21} />}
        tone="orange"
        description="Accounts currently disabled"
      />

      <StatCard
        title="Orders"
        value={customers.reduce(
          (sum, customer) => sum + (customer.order_count || 0),
          0,
        )}
        icon={<ShoppingBag size={21} />}
        tone="blue"
        description="Orders linked to customers"
      />
    </div>

    <div className="panel">
      <div className="panel-heading">
        <div>
          <h3>Customers</h3>
          <p>Search and filter registered customer accounts.</p>
        </div>
      </div>

      <div className="filters-row">
        <div className="search-field">
          <Search size={17} />
          <input
            type="search"
            placeholder="Search name, email, phone or ID"
            value={customersSearch}
            onChange={(event) => setCustomersSearch(event.target.value)}
          />
        </div>

        <select
          value={customersStatusFilter}
          onChange={(event) => setCustomersStatusFilter(event.target.value)}
        >
          <option value="all">All customers</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <button
          className="secondary-button"
          onClick={() => void loadCustomers()}
          disabled={loading}
        >
          <Search size={16} />
          Search
        </button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Orders</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <strong>{customer.name}</strong>
                  <small className="table-subtext">
                    Customer #{customer.id}
                  </small>
                </td>

                <td>{customer.phone || '—'}</td>

                <td>{customer.email || '—'}</td>

                <td>{customer.order_count ?? 0}</td>

                <td>
                  <span
                    className={
                      Boolean(customer.is_active)
                        ? 'status-badge status-success'
                        : 'status-badge status-danger'
                    }
                  >
                    {Boolean(customer.is_active) ? 'Active' : 'Inactive'}
                  </span>
                </td>

                <td>
                  {customer.created_at
                    ? new Date(customer.created_at).toLocaleDateString('en-IN')
                    : '—'}
                </td>

                <td>
                  <button
                    className="small-outline-button"
                    onClick={() => void loadCustomerDetails(customer.id)}
                    disabled={loadingCustomerDetails}
                  >
                    <Eye size={15} />
                    View
                  </button>
                </td>
              </tr>
            ))}

            {customers.length === 0 && !loading && (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    title="No customers found"
                    description="No customer accounts match the current search or filter."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        Showing {customers.length} customer
        {customers.length === 1 ? '' : 's'}
      </div>
    </div>
  </section>
)}
{selectedCustomer && (
  <div className="modal-backdrop" onClick={() => setSelectedCustomer(null)}>
    <div
      className="modal-card"
      onClick={(event) => event.stopPropagation()}
      style={{ maxWidth: '760px', width: '100%' }}
    >
      <div className="modal-header">
        <div>
          <h2>Customer Details</h2>
          <p>
            Customer #{selectedCustomer.customer.id} ·{' '}
            {selectedCustomer.customer.name}
          </p>
        </div>

        <button
          type="button"
          className="modal-close"
          onClick={() => setSelectedCustomer(null)}
        >
          ×
        </button>
      </div>

      {loadingCustomerDetails ? (
        <div className="empty-state">
          <p>Loading customer details...</p>
        </div>
      ) : (
        <div className="customer-details-content">
          <div className="customer-detail-grid">
            <div className="detail-card">
              <span>Name</span>
              <strong>{selectedCustomer.customer.name}</strong>
            </div>

            <div className="detail-card">
              <span>Phone</span>
              <strong>{selectedCustomer.customer.phone || '—'}</strong>
            </div>

            <div className="detail-card">
              <span>Email</span>
              <strong>{selectedCustomer.customer.email || '—'}</strong>
            </div>

            <div className="detail-card">
              <span>Status</span>
              <strong>
                {Boolean(selectedCustomer.customer.is_active)
                  ? 'Active'
                  : 'Inactive'}
              </strong>
            </div>

            <div className="detail-card">
              <span>Session version</span>
              <strong>{selectedCustomer.customer.session_version}</strong>
            </div>

            <div className="detail-card">
              <span>Joined</span>
              <strong>
                {selectedCustomer.customer.created_at
                  ? new Date(
                      selectedCustomer.customer.created_at,
                    ).toLocaleDateString('en-IN')
                  : '—'}
              </strong>
            </div>
          </div>

          <div className="detail-section">
            <h3>Profile</h3>

            {selectedCustomer.profile ? (
              <div className="detail-list">
                <div>
                  <span>Date of birth</span>
                  <strong>
                    {selectedCustomer.profile.date_of_birth || '—'}
                  </strong>
                </div>

                <div>
                  <span>Gender</span>
                  <strong>{selectedCustomer.profile.gender || '—'}</strong>
                </div>

                <div>
                  <span>Language</span>
                  <strong>{selectedCustomer.profile.language || '—'}</strong>
                </div>

                <div>
                  <span>Currency</span>
                  <strong>{selectedCustomer.profile.currency || 'INR'}</strong>
                </div>
              </div>
            ) : (
              <p className="muted-text">No profile information available.</p>
            )}
          </div>

          <div className="detail-section">
            <h3>Order Summary</h3>

            <div className="customer-detail-grid">
              <div className="detail-card">
                <span>Total orders</span>
                <strong>
                  {selectedCustomer.orderSummary.total_orders}
                </strong>
              </div>

              <div className="detail-card">
                <span>Delivered</span>
                <strong>
                  {selectedCustomer.orderSummary.delivered_orders}
                </strong>
              </div>

              <div className="detail-card">
                <span>Cancelled</span>
                <strong>
                  {selectedCustomer.orderSummary.cancelled_orders}
                </strong>
              </div>

              <div className="detail-card">
                <span>Total spent</span>
                <strong>
                  ₹{selectedCustomer.orderSummary.total_spent.toLocaleString(
                    'en-IN',
                  )}
                </strong>
              </div>
            </div>
          </div>
          <div className="detail-section">
  <div className="detail-section-heading">
    <div>
      <h3>All Orders</h3>
      <p className="muted-text">
        Complete order history for this customer.
      </p>
    </div>

    <span className="status-badge status-info">
      {selectedCustomer.orders.length} order
      {selectedCustomer.orders.length === 1 ? '' : 's'}
    </span>
  </div>

  {selectedCustomer.orders.length === 0 ? (
    <p className="muted-text">No orders found for this customer.</p>
  ) : (
    <div className="customer-orders-list">
      {selectedCustomer.orders.map((order) => (
       <div
  className="customer-order-card"
  key={order.id}
  onClick={() => void openOrderDetails(order)}
  role="button"
  tabIndex={0}
  onKeyDown={(event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      void openOrderDetails(order)
    }
  }}
>
          <div className="customer-order-main">
            <div>
              <strong>{order.order_number}</strong>
              <span className="table-subtext">
                {order.created_at
                  ? new Date(order.created_at).toLocaleString('en-IN')
                  : '—'}
              </span>
            </div>

            <span
              className={
                order.status === 'Delivered'
                  ? 'status-badge status-success'
                  : order.status === 'Cancelled'
                    ? 'status-badge status-danger'
                    : 'status-badge status-warning'
              }
            >
              {order.status}
            </span>
          </div>

          <div className="customer-order-meta">
            <div>
              <span>Total</span>
              <strong>
                ₹{Number(order.total_amount || 0).toLocaleString('en-IN')}
              </strong>
            </div>

            <div>
              <span>Payment</span>
              <strong>
                {order.payment_method || '—'} ·{' '}
                {order.payment_status || '—'}
              </strong>
            </div>

            <div>
              <span>Delivery</span>
              <strong>
                {order.delivery_city || '—'}
                {order.delivery_pincode
                  ? ` - ${order.delivery_pincode}`
                  : ''}
              </strong>
            </div>

            <div>
              <span>Rider</span>
              <strong>
                {order.assigned_rider_id
                  ? `Rider #${order.assigned_rider_id}`
                  : 'Not assigned'}
              </strong>
            </div>
          </div>

          {order.cancellation_reason && (
            <div className="customer-order-note">
              <span>Cancellation reason</span>
              <p>{order.cancellation_reason}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )}
</div>

          <div className="detail-section">
            <h3>Addresses</h3>

            {selectedCustomer.addresses.length === 0 ? (
              <p className="muted-text">No saved addresses.</p>
            ) : (
              <div className="address-list">
                {selectedCustomer.addresses.map((address) => (
                  <div className="address-card" key={address.id}>
                    <div>
                      <strong>{address.label}</strong>

                      {Boolean(address.is_default) && (
                        <span className="status-badge status-success">
                          Default
                        </span>
                      )}
                    </div>

                    <p>
                      {address.full_name}
                      <br />
                      {address.phone}
                      <br />
                      {address.address_line1}
                      {address.address_line2
                        ? `, ${address.address_line2}`
                        : ''}
                      <br />
                      {address.city}, {address.state} - {address.pincode}
                      {address.landmark
                        ? ` · ${address.landmark}`
                        : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="modal-footer">
        <button
          type="button"
          className="secondary-button"
          onClick={() => setSelectedCustomer(null)}
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}

          {page === 'homepage' && <HomepageCms token={token} />}
          {page === 'audit' && (
            <section className="page-section">
              <div className="section-toolbar">
                <div>
                  <h2>Audit trail</h2>
                  <p>Review administrative actions recorded by the system.</p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => void loadAuditLogs()}
                >
                  <RefreshCw size={16} />
                  Refresh logs
                </button>
              </div>

              <div className="panel">
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>Entity</th>
                        <th>Entity ID</th>
                        <th>Details</th>
                        <th>Admin</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id}>
                          <td>
                            <span className="audit-action">{log.action}</span>
                          </td>
                          <td>{log.entityType}</td>
                          <td>{log.entityId ?? 'â€”'}</td>
                          <td className="audit-details">
                            {log.details || 'â€”'}
                          </td>
                          <td>{log.adminEmail || 'â€”'}</td>
                          <td>{formatDate(log.createdAt)}</td>
                        </tr>
                      ))}

                      {auditLogs.length === 0 && !loading && (
                        <tr>
                          <td colSpan={6}>
                            <EmptyState
                              title="No audit records"
                              description="Administrative activity will appear here."
                            />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="table-footer">
                  Showing {auditLogs.length} audit records
                </div>
              </div>
            </section>
          )}

          <footer className="admin-footer">
            <span>Â© {new Date().getFullYear()} Riya Quick Commerce</span>
            <span>
              <ShieldCheck size={14} />
              Secure admin workspace
            </span>
          </footer>
        </div>
      </main>

      {productModalOpen && (
        <Modal
          className="product-edit-modal"
          title={editingProduct ? 'Edit product' : 'Add new product'}
          subtitle="Enter the product information below."
          onClose={() => setProductModalOpen(false)}
        >
          <form className="modal-form" onSubmit={saveProduct}>
            <div className="form-field">
              <label htmlFor="product-name">Product name *</label>
              <input
                id="product-name"
                value={productForm.name}
                onChange={(event) =>
                  setProductForm({ ...productForm, name: event.target.value })
                }
                placeholder="e.g. Smart LED Bulb"
                maxLength={150}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="product-description">Description</label>
              <textarea
                id="product-description"
                value={productForm.description}
                onChange={(event) =>
                  setProductForm({
                    ...productForm,
                    description: event.target.value,
                  })
                }
                placeholder="Describe your product..."
                rows={3}
                maxLength={2000}
              />
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="product-category">Category *</label>
                <select
                  id="product-category"
                  value={productForm.categoryId}
                  onChange={(event) =>
                    setProductForm({
                      ...productForm,
                      categoryId: event.target.value,
                    })
                  }
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="product-sku">SKU</label>
                <input
                  id="product-sku"
                  value={productForm.sku}
                  onChange={(event) =>
                    setProductForm({ ...productForm, sku: event.target.value })
                  }
                  placeholder="Product SKU"
                  maxLength={80}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="product-price">Selling price (â‚¹) *</label>
                <input
                  id="product-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.price}
                  onChange={(event) =>
                    setProductForm({ ...productForm, price: event.target.value })
                  }
                  placeholder="0"
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="product-original-price">Original price (â‚¹)</label>
                <input
                  id="product-original-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.originalPrice}
                  onChange={(event) =>
                    setProductForm({
                      ...productForm,
                      originalPrice: event.target.value,
                    })
                  }
                  placeholder="Optional"
                />
              </div>
            </div>

            {!editingProduct && (
              <div className="form-field">
                <label htmlFor="product-stock">Initial stock *</label>
                <input
                  id="product-stock"
                  type="number"
                  min="0"
                  step="1"
                  value={productForm.stock}
                  onChange={(event) =>
                    setProductForm({ ...productForm, stock: event.target.value })
                  }
                  required
                />
              </div>
            )}

            <div className="form-field">
              <label htmlFor="product-image">Product image URL</label>
              <input
                id="product-image"
                type="url"
                value={productForm.imageUrl}
                onChange={(event) =>
                  setProductForm({
                    ...productForm,
                    imageUrl: event.target.value,
                  })
                }
                placeholder="https://example.com/image.jpg"
              />
            </div>

            {editingProduct && (
  <div className="product-details-section">
    <div className="panel-heading">
      <div>
        <h3>Product Details Management</h3>
        <p>Gallery, specifications, recommendations and customer reviews.</p>
      </div>
    </div>

    {loadingProductDetails ? (
      <p>Loading product details...</p>
    ) : productDetails ? (
      <>
        <div className="form-field">
          <strong>Product Gallery</strong>
          
<input
  type="file"
  accept="image/jpeg,image/png,image/webp,image/gif"
  multiple
  onChange={(event) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 10) {
      setError('You can select a maximum of 10 images at a time.');
      event.target.value = '';
      return;
    }
    setSelectedProductImages(files);
  }}
/>

{selectedProductImages.length > 0 && (
  <div className="form-field">
    <strong>Selected images preview</strong>
    {selectedProductImages.map((file, index) => (
      <div key={`${file.name}-${index}`}>
        <span>{file.name}</span>
        <span> ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
      </div>
    ))}

    <button
      type="button"
      className="primary-button"
      onClick={uploadProductImages}
      disabled={uploadingProductImages}
    >
      {uploadingProductImages ? 'Uploading...' : 'Upload images'}
    </button>
  </div>
)}

          <p>{productDetails.images.length} uploaded image(s)</p>
          
<div className="product-gallery-grid">
  {productDetails.images.map((image) => (
    <div className="product-gallery-item" key={image.id}>
      <img
        src={
          image.imageUrl.startsWith('http')
            ? image.imageUrl
            : `http://localhost:5000${image.imageUrl}`
        }
        alt={image.altText || 'Product image'}
        className="product-gallery-preview"
      />

      <div>
        {image.isPrimary && <strong>Primary image</strong>}
        <p>Image #{image.sortOrder + 1}</p>
        <button
  type="button"
  className="secondary-button"
  onClick={() => deleteProductImage(image.id)}
>
  Delete image
</button>
      </div>
    </div>
  ))}
</div>

        </div>

        <div className="form-field">
          <strong>Specifications</strong>
          
<div className="form-field">
  {specificationRows.map((spec, index) => (
    <div className="form-row" key={index}>
      <input
        value={spec.name}
        placeholder="Specification name (e.g. Wattage)"
        onChange={(event) => {
          const updated = [...specificationRows];
          updated[index] = {
            ...updated[index],
            name: event.target.value,
          };
          setSpecificationRows(updated);
        }}
      />

      <input
        value={spec.value}
        placeholder="Value (e.g. 590W)"
        onChange={(event) => {
          const updated = [...specificationRows];
          updated[index] = {
            ...updated[index],
            value: event.target.value,
          };
          setSpecificationRows(updated);
        }}
      />

      <button
        type="button"
        className="secondary-button"
        onClick={() =>
          setSpecificationRows(
            specificationRows.filter((_, i) => i !== index),
          )
        }
      >
        Remove
      </button>
    </div>
  ))}

  <button
    type="button"
    className="secondary-button"
    onClick={() =>
      setSpecificationRows([
        ...specificationRows,
        { name: '', value: '' },
      ])
    }
  >
    + Add specification
  </button>

  <button
    type="button"
    className="primary-button"
    onClick={saveProductSpecifications}
    disabled={savingProductDetails}
  >
    {savingProductDetails ? 'Saving...' : 'Save specifications'}
  </button>
</div>

          {productDetails.specifications.length ? (
            productDetails.specifications.map((spec) => (
              <p key={spec.id}>
                {spec.name}: {spec.value}
              </p>
            ))
          ) : (
            <p>No specifications added yet.</p>
          )}
        </div>

        <div className="form-field">
          <strong>Recommended Products</strong>
          
<div className="form-field">
  <label>Select products to recommend</label>

  {products.filter((item) => item.id !== editingProduct?.id).length === 0 ? (
    <p>No other products available.</p>
  ) : (
products
  .filter((item) => item.id !== editingProduct?.id)
  .map((item) => (
    <label
      key={item.id}
      className="checkbox-field recommendation-card"
    >
      <input
        type="checkbox"
        checked={selectedRecommendationIds.includes(item.id)}
        onChange={(event) => {
          setSelectedRecommendationIds((current) =>
            event.target.checked
              ? [...current, item.id]
              : current.filter((id) => id !== item.id),
          );
        }}
      />

      <img
        className="recommendation-image"
        src={
          item.imageUrl
            ? item.imageUrl.startsWith('http')
              ? item.imageUrl
              : `http://localhost:5000${item.imageUrl}`
            : '/placeholder-product.png'
        }
        alt={item.name}
        onError={(event) => {
          event.currentTarget.style.visibility = 'hidden';
        }}
      />

      <span className="recommendation-info">
        <strong>{item.name}</strong>
        <span>â‚¹{item.price.toLocaleString('en-IN')}</span>
      </span>
    </label>
  ))
  )}

  <button
    type="button"
    className="primary-button"
    onClick={saveProductRecommendations}
    disabled={savingProductDetails}
  >
    {savingProductDetails ? 'Saving...' : 'Save recommendations'}
  </button>
</div>

          {productDetails.recommendations.length ? (
            productDetails.recommendations.map((item) => (
              <p key={item.id}>{item.name}</p>
            ))
          ) : (
            <p>No recommended products added yet.</p>
          )}
        </div>

        <div className="form-field">
          <strong>Customer Reviews</strong>
          <p>
            Average rating: {productDetails.rating.averageRating} / 5
            {' · '}
            {productDetails.rating.reviewCount} review(s)
          </p>

          {productDetails.reviews.length ? (
            productDetails.reviews.map((review) => (
              <div key={review.id}>
                <p>
                  <strong>{review.customerName}</strong>
                  {' · '}
                  {review.rating}/5
                </p>
                <p>{review.reviewText}</p>
                <p>Moderation status: {review.status}</p>
                
<div className="form-row">
  <button
    type="button"
    className="primary-button"
    disabled={savingProductDetails || review.status === 'approved'}
    onClick={() => moderateProductReview(review.id, 'approved')}
  >
    Approve
  </button>

  <button
    type="button"
    className="secondary-button"
    disabled={savingProductDetails || review.status === 'rejected'}
    onClick={() => moderateProductReview(review.id, 'rejected')}
  >
    Reject
  </button>
</div>

              </div>
            ))
          ) : (
            <p>No customer reviews yet.</p>
          )}
        </div>
      </>
    ) : (
      <p>Product details could not be loaded.</p>
    )}
  </div>
)}

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setProductModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={savingProduct}
              >
                {savingProduct ? 'Saving...' : 'Save product'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {categoryModalOpen && (
        <Modal
          title={editingCategory ? 'Edit category' : 'Add category'}
          subtitle="Create and organise your product categories."
          onClose={() => setCategoryModalOpen(false)}
        >
          <form className="modal-form" onSubmit={saveCategory}>
            <div className="form-field">
              <label htmlFor="category-name">Category name *</label>
              <input
                id="category-name"
                value={categoryForm.name}
                onChange={(event) =>
                  setCategoryForm({ ...categoryForm, name: event.target.value })
                }
                placeholder="e.g. Electronics"
                maxLength={100}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="category-description">Description</label>
              <textarea
                id="category-description"
                value={categoryForm.description}
                onChange={(event) =>
                  setCategoryForm({
                    ...categoryForm,
                    description: event.target.value,
                  })
                }
                placeholder="Describe this category..."
                rows={4}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setCategoryModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={savingCategory}
              >
                {savingCategory ? 'Saving...' : 'Save category'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {riderModalOpen && (
        <Modal
          title={editingRider ? 'Edit rider' : 'Add new rider'}
          subtitle={editingRider ? 'Update delivery account information.' : 'Create login credentials for a delivery rider.'}
          onClose={() => setRiderModalOpen(false)}
        >
          <form className="modal-form" onSubmit={saveRider}>
            <div className="form-field">
              <label htmlFor="rider-name">Full name *</label>
              <input
                id="rider-name"
                value={riderForm.name}
                onChange={(event) => setRiderForm({ ...riderForm, name: event.target.value })}
                placeholder="Enter rider name"
                required
                maxLength={100}
              />
            </div>

            <div className="form-field">
              <label htmlFor="rider-phone">Mobile number *</label>
              <input
                id="rider-phone"
                type="tel"
                value={riderForm.phone}
                onChange={(event) => setRiderForm({ ...riderForm, phone: event.target.value })}
                placeholder="Enter mobile number"
                required
                maxLength={20}
              />
            </div>

            <div className="form-field">
              <label htmlFor="rider-email">Email address</label>
              <input
                id="rider-email"
                type="email"
                value={riderForm.email}
                onChange={(event) => setRiderForm({ ...riderForm, email: event.target.value })}
                placeholder="Optional email address"
                maxLength={150}
              />
            </div>

            <div className="form-field">
              <label htmlFor="rider-password">
                Password {editingRider ? '(leave blank to keep current password)' : '*'}
              </label>
              <input
                id="rider-password"
                type="password"
                value={riderForm.password}
                onChange={(event) => setRiderForm({ ...riderForm, password: event.target.value })}
                placeholder={editingRider ? 'Optional new password' : 'Minimum 8 characters'}
                minLength={8}
                maxLength={72}
                required={!editingRider}
                autoComplete="new-password"
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setRiderModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={savingRider}>
                {savingRider ? 'Saving...' : editingRider ? 'Save changes' : 'Create rider'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {selectedOrder && (
        <Modal
  title={`Order ${selectedOrder.order_number}`}
  subtitle={`Placed ${formatDate(selectedOrder.created_at)} · ${selectedOrder.status}`}
  onClose={() => setSelectedOrder(null)}
  className="order-details-modal"
>
          <div className="modal-form">
            <div className="panel-heading"><div><h3>Customer details</h3><p>{selectedOrder.customer_name}</p></div></div>
            <p><Phone size={15} /> {selectedOrder.customer_phone} {selectedOrder.customer_email ? `· ${selectedOrder.customer_email}` : ''}</p>
            <p><MapPin size={15} /> {[selectedOrder.delivery_address, selectedOrder.delivery_city, selectedOrder.delivery_state, selectedOrder.delivery_pincode].filter(Boolean).join(', ') || 'Address not provided'}</p>
            {selectedOrder.customer_notes && <p><strong>Customer note:</strong> {selectedOrder.customer_notes}</p>}
            <div className="panel-heading"><div><h3>Order items</h3></div></div>
            <div className="table-responsive"><table className="data-table"><thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>
              {(selectedOrder.items || []).map((item) => <tr key={item.id}><td><strong>{item.product_name}</strong><small className="table-subtext">{item.sku || ''}</small></td><td>{item.quantity}</td><td>{formatCurrency(item.unit_price)}</td><td>{formatCurrency(item.line_total)}</td></tr>)}
              {(selectedOrder.items || []).length === 0 && <tr><td colSpan={4}>No item details available.</td></tr>}
            </tbody></table></div>
            <div className="stock-current-box"><div className="summary-row"><span>Subtotal</span><strong>{formatCurrency(selectedOrder.subtotal)}</strong></div><div className="summary-row"><span>Delivery fee</span><strong>{formatCurrency(selectedOrder.delivery_fee)}</strong></div><div className="summary-row"><span>Discount</span><strong>{formatCurrency(selectedOrder.discount)}</strong></div><div className="summary-row"><span>Total</span><strong>{formatCurrency(selectedOrder.total_amount)}</strong></div><div className="summary-row"><span>Payment</span><strong>{selectedOrder.payment_method} · {selectedOrder.payment_status}</strong></div></div>
            {selectedOrder.cancellation_reason && <p><strong>Cancellation reason:</strong> {selectedOrder.cancellation_reason}</p>}
            <div className="panel-heading"><div><h3>Order timeline</h3><p>Status changes recorded by the system</p></div></div>
            {(selectedOrder.events || []).map((event) => <div className="summary-row" key={event.id}><span>{event.old_status || 'Created'} → <strong>{event.new_status}</strong><small className="table-subtext">{event.note || ''} · {formatDate(event.created_at)}</small></span><small>{event.changed_by_email || 'System'}</small></div>)}
            {!['Delivered', 'Cancelled', 'Out for Delivery'].includes(selectedOrder.status) && (
              <>
                <div className="form-field"><label htmlFor="order-note">Update note / cancellation reason</label><textarea id="order-note" rows={3} value={orderNote} onChange={(event) => setOrderNote(event.target.value)} placeholder="Add an optional note. Required when cancelling." /></div>
                <div className="modal-actions" style={{ flexWrap: 'wrap' }}>
                  {selectedOrder.status === 'Placed' && <button className="primary-button" disabled={updatingOrder} onClick={() => void updateOrderStatus('Confirmed')}>Confirm order</button>}
                  {selectedOrder.status === 'Confirmed' && <button className="primary-button" disabled={updatingOrder} onClick={() => void updateOrderStatus('Packed')}>Mark packed</button>}
                  {selectedOrder.status === 'Packed' && <button className="primary-button" disabled={updatingOrder} onClick={() => void updateOrderStatus('Ready for Dispatch')}>Ready for dispatch</button>}
                  {['Placed', 'Confirmed', 'Packed'].includes(selectedOrder.status) && <button className="secondary-button" disabled={updatingOrder || !orderNote.trim()} onClick={() => void updateOrderStatus('Cancelled')}>Cancel order</button>}
                </div>
              </>
            )}
            {selectedOrder.status === 'Ready for Dispatch' && (
              <div className="panel" style={{ padding: '16px', marginTop: '16px' }}>
                <div className="panel-heading">
                  <div>
                    <h3>Assign delivery rider</h3>
                    <p>Select an active rider to dispatch this order.</p>
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="assign-rider">Active rider</label>
                  <select
                    id="assign-rider"
                    value={selectedRiderId}
                    onChange={(event) => setSelectedRiderId(event.target.value)}
                    disabled={assigningOrder}
                  >
                    <option value="">Select a rider</option>
                    {riders.filter((rider) => Boolean(rider.is_active)).map((rider) => (
                      <option key={rider.id} value={rider.id}>
                        {rider.name} — {rider.phone}
                      </option>
                    ))}
                  </select>
                  {riders.filter((rider) => Boolean(rider.is_active)).length === 0 && (
                    <small>No active riders available. Add or activate a rider in Rider Management.</small>
                  )}
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!selectedRiderId || assigningOrder}
                    onClick={() => void assignOrderToRider()}
                  >
                    {assigningOrder ? 'Assigning...' : 'Assign & dispatch order'}
                  </button>
                </div>
              </div>
            )}

            {selectedOrder.status === 'Out for Delivery' && <p>Delivery status is managed by the assigned rider.</p>}
            {updatingOrder && <div className="loading-line"><RefreshCw size={16} className="spin" /> Updating order...</div>}
          </div>
        </Modal>
      )}

      {stockProduct && (
        <Modal
          title="Adjust inventory"
          subtitle={`Update stock quantity for ${stockProduct.name}.`}
          onClose={() => setStockProduct(null)}
        >
          <form className="modal-form" onSubmit={saveStock}>
            <div className="stock-current-box">
              <span>Current stock</span>
              <strong>{stockProduct.stock} units</strong>
            </div>

            <div className="form-field">
              <label htmlFor="new-stock">New stock quantity *</label>
              <input
                id="new-stock"
                type="number"
                min="0"
                step="1"
                value={stockValue}
                onChange={(event) => setStockValue(event.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="stock-reason">Reason for adjustment *</label>
              <input
                id="stock-reason"
                value={stockReason}
                onChange={(event) => setStockReason(event.target.value)}
                placeholder="e.g. New stock received"
                maxLength={250}
                required
              />
            </div>

            <div className="stock-change-preview">
              <span>Stock change</span>
              <strong
                className={
                  Number(stockValue) - stockProduct.stock >= 0
                    ? 'positive-change'
                    : 'negative-change'
                }
              >
                {Number(stockValue) - stockProduct.stock >= 0 ? '+' : ''}
                {Number(stockValue || 0) - stockProduct.stock} units
              </strong>
            </div>

            


            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setStockProduct(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={savingStock}
              >
                {savingStock ? 'Updating...' : 'Update stock'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  tone,
  description,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  tone: 'green' | 'blue' | 'orange' | 'red';
  description: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span>{title}</span>
        <div className={`stat-icon ${tone}`}>{icon}</div>
      </div>
      <div className="stat-value">{value.toLocaleString('en-IN')}</div>
      <div className="stat-description">{description}</div>
    </div>
  );
}

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) {
    return <span className="status-pill status-inactive">Out of stock</span>;
  }

  if (stock <= 10) {
    return <span className="status-pill status-warning">Low stock</span>;
  }

  return <span className="status-pill status-active">In stock</span>;
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Package size={25} />
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function InventoryTable({
  logs,
  compact = false,
}: {
  logs: InventoryLog[];
  compact?: boolean;
}) {
  return (
    <div className="table-responsive">
      <table className="data-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Previous stock</th>
            <th>Change</th>
            <th>New stock</th>
            <th>Reason</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {logs.slice(0, compact ? 5 : 100).map((log) => (
            <tr key={log.id}>
              <td>
                <strong>{log.productName}</strong>
                {log.sku && <small className="table-subtext">{log.sku}</small>}
              </td>
              <td>{log.previousStock}</td>
              <td>
                <span
                  className={
                    log.changeAmount >= 0
                      ? 'stock-change positive-change'
                      : 'stock-change negative-change'
                  }
                >
                  {log.changeAmount >= 0 ? (
                    <ArrowUp size={14} />
                  ) : (
                    <ArrowDown size={14} />
                  )}
                  {log.changeAmount > 0 ? '+' : ''}
                  {log.changeAmount}
                </span>
              </td>
              <td>
                <strong>{log.newStock}</strong>
              </td>
              <td>{log.reason || 'â€”'}</td>
              <td>{formatDate(log.createdAt)}</td>
            </tr>
          ))}

          {logs.length === 0 && (
            <tr>
              <td colSpan={6}>
                <EmptyState
                  title="No inventory activity"
                  description="Stock changes will be recorded here."
                />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
  className = "",
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
    className?: string;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className={`modal-card ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close modal"
            type="button"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default App;









