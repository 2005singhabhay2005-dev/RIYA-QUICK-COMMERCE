const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export type ApiProduct = {
  id: number
  name: string
  slug: string
  description: string
  price: number
  originalPrice: number | null
  stock: number
  imageUrl: string
  sku: string | null
  category: string
  categorySlug: string
}

export type ApiCategory = {
  id: number
  name: string
  slug: string
  description: string
  product_count: number
}

type ApiResponse<T> = {
  success: boolean
  data: T
  message?: string
  total?: number
}

async function request<T>(endpoint: string): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_URL}${endpoint}`)

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }

  return response.json() as Promise<ApiResponse<T>>
}

export function getProducts(search = '', category = '') {
  const params = new URLSearchParams()

  if (search.trim()) params.set('search', search.trim())
  if (category && category !== 'All') {
    params.set('category', category.toLowerCase().replaceAll(' ', '-').replaceAll('&-', ''))
  }

  const query = params.toString()

  return request<ApiProduct[]>(`/products${query ? `?${query}` : ''}`)
}

export function getCategories() {
  return request<ApiCategory[]>('/categories')
}

export function checkApiHealth() {
  return request<{
    message: string
    database: string
    timestamp: string
  }>('/health')
}

export type ProductDetailImage = {
  id: number | null
  imageUrl: string
  altText: string
  sortOrder: number
  isPrimary: number
}

export type ProductSpecification = {
  id: number
  name: string
  value: string
  sortOrder: number
}

export type ProductReview = {
  id: number
  customerName: string
  rating: number
  title: string
  reviewText: string
  adminReply: string | null
  createdAt: string
}

export type ProductRecommendation = {
  id: number
  name: string
  slug: string
  price: number
  originalPrice: number | null
  imageUrl: string
  stock: number
  description: string
}

export type ProductDetailsData = {
  product: ApiProduct & {
    categoryId: number
    isActive: number
  }
  images: ProductDetailImage[]
  specifications: ProductSpecification[]
  reviews: ProductReview[]
  rating: {
    averageRating: number
    reviewCount: number
  }
  recommendations: ProductRecommendation[]
}

export function getProductDetails(id: number) {
  return request<ProductDetailsData>(`/products/${id}/details`)
}
// ============================================================
// HOMEPAGE CMS
// ============================================================

export type ApiHomepageBanner = {
  id: number
  title: string
  subtitle: string
  imageUrl: string
  bannerType: 'hero' | 'promo'
  ctaText: string
  ctaLink: string
  sortOrder: number
  isActive: boolean
  isPublished: boolean
}

export function getHomepageBanners() {
  return request<ApiHomepageBanner[]>('/homepage-cms')
}