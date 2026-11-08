import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
 MapPin, ShoppingCart, UserRound, ChevronDown,
  ArrowRight, Plus, Minus, Heart, Zap, ShieldCheck,
  Truck, Headphones, X, Menu, Sparkles, Star, Package,
  ArrowUpRight, Tag, ShoppingBag, RefreshCw,
} from 'lucide-react'

import ProductFilters, { type ProductFilterItem } from './components/ProductFilters'
import SmartSearch from './components/SmartSearch'
import LocationSelector from './components/LocationSelector'
import CustomerAuth from './components/CustomerAuth'
import CustomerCheckout from './components/CustomerCheckout'
import MyOrders from './components/MyOrders'
import CustomerProfile from './components/CustomerProfile'

import { getCustomerSession, clearCustomerSession, type Customer } from './services/customerApi'
import {
  getProducts,
  getHomepageBanners,
  type ApiProduct,
  type ApiHomepageBanner,
} from './services/api'

// ============================================================
// TYPES
// ============================================================
type Product = {
  id: number
  name: string
  category: string
  description: string
  price: number
  mrp: number
  unit: string
  image: string
  tag?: string
  rating: number
}

type SortOption = 'recommended' | 'price-low' | 'price-high' | 'name'

// ============================================================
// CONSTANTS
// ============================================================
const CATEGORIES = [
  { name: 'All', icon: '\u{1F6D2}', color: '#FFF1C2' },
  { name: 'Grocery', icon: '\u{1F6D2}', color: '#E4F5E6' },
  { name: 'Fruits', icon: '\u{1F34E}', color: '#FFE6DF' },
  { name: 'Electronics', icon: '\u{1F4F1}', color: '#E8E9FF' },
  { name: 'Solar', icon: '\u2600\uFE0F', color: '#FFF0BD' },
  { name: 'Home', icon: '\u{1F3E0}', color: '#E6F2FF' },
  { name: 'Personal Care', icon: '\u{1F9F4}', color: '#F9E5F3' },
  { name: 'Electrical', icon: '\u26A1', color: '#FFF0D9' },
] as const

const FALLBACK_IMAGES: Record<string, string> = {
  Grocery: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600',
  Fruits: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600',
  Electronics: 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=600',
  Solar: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600',
  Home: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600',
  'Personal Care': 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600',
  Electrical: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600',
}

const DEFAULT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600'

const CART_STORAGE_KEY = 'riya-cart'
const WISHLIST_STORAGE_KEY = 'riya-wishlist'
const LOCATION_STORAGE_KEY = 'riya-selected-location'
const DEFAULT_LOCATION = 'Kannauj, UP'

// ============================================================
// HELPERS
// ============================================================
function normalizeCategory(category: string): string {
  const normalized = category.trim().toLowerCase()
  if (normalized === 'home & living' || normalized === 'home and living') return 'Home'
  if (normalized === 'personal care') return 'Personal Care'
  return category
}

function mapApiProduct(item: ApiProduct): Product {
  const category = normalizeCategory(item.category || 'Other')
  return {
    id: item.id,
    name: item.name,
    category,
    description: item.description || 'Quality product from Riya Quick Commerce',
    price: Number(item.price) || 0,
    mrp: Number(item.originalPrice ?? item.price) || 0,
    unit: '1 piece',
    image: item.imageUrl || FALLBACK_IMAGES[category] || DEFAULT_FALLBACK_IMAGE,
    rating: 0,
  }
}

const formatPrice = (price: number) => `₹${Number(price || 0).toLocaleString('en-IN')}`

// Safe localStorage readers (run once, don't throw on SSR or corruption)
function readCartFromStorage(): Record<number, number> {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '{}')
    if (!parsed || typeof parsed !== 'object') return {}
    // Sanitize: only positive integer quantities
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([k, v]) => [Number(k), Number(v)] as const)
        .filter(([k, v]) => Number.isInteger(k) && Number.isFinite(v) && v > 0)
    )
  } catch {
    return {}
  }
}

function readWishlistFromStorage(): number[] {
  try {
    const saved = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY) || '[]')
    return Array.isArray(saved) ? saved.filter((id) => Number.isInteger(id)) : []
  } catch {
    return []
  }
}

function readLocationFromStorage(): string {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCATION_STORAGE_KEY) || 'null')
    return saved?.label || DEFAULT_LOCATION
  } catch {
    return DEFAULT_LOCATION
  }
}

// ============================================================
// MAIN APP
// ============================================================
function App() {
  const navigate = useNavigate()
  const handleCmsCta = (link: string) => {
  const target = (link || '#products').trim()

  if (target.startsWith('#')) {
    const element = document.getElementById(target.slice(1))

    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }

    return
  }

  if (target.startsWith('/')) {
    navigate(target)
    return
  }

  if (/^https?:\/\//i.test(target)) {
    window.open(target, '_blank', 'noopener,noreferrer')
  }
}

  // ---------- Products ----------
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  // ---------- Homepage CMS ----------
const [homepageBanners, setHomepageBanners] =
  useState<ApiHomepageBanner[]>([])

const heroBanner = homepageBanners.find(
  (banner) => banner.bannerType === 'hero'
)

const promoBanner = homepageBanners.find(
  (banner) => banner.bannerType === 'promo'
)

  // ---------- UI state ----------
  const [authOpen, setAuthOpen] = useState(false)
  const [customer, setCustomer] = useState<Customer | null>(
    () => getCustomerSession()?.customer ?? null
  )
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [myOrdersOpen, setMyOrdersOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // ---------- Filters ----------
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [sortBy, setSortBy] = useState<SortOption>('recommended')
  const [filterResults, setFilterResults] =
  useState<ProductFilterItem[] | null>(null)

  // ---------- Persisted state ----------
  const [cart, setCart] = useState<Record<number, number>>(readCartFromStorage)
  const [wishlist, setWishlist] = useState<number[]>(readWishlistFromStorage)
  const [selectedLocation, setSelectedLocation] = useState<string>(readLocationFromStorage)

  // ============================================================
  // DATA LOADING
  // ============================================================
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true)
      setApiError('')

      const response = await getProducts()

      if (!response.success || !Array.isArray(response.data)) {
        throw new Error('Invalid product data received from server.')
      }

      setProducts(response.data.map(mapApiProduct))
    } catch (error) {
      console.error('Product loading error:', error)
      setApiError(
        error instanceof Error
          ? error.message
          : 'Unable to connect to the product server.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])
  // ---------- Homepage CMS loading ----------
useEffect(() => {
  let cancelled = false

  async function loadHomepageBanners() {
    try {
      const response = await getHomepageBanners()

      if (!response.success || !Array.isArray(response.data)) {
        throw new Error('Invalid homepage banner response')
      }

      if (!cancelled) {
        setHomepageBanners(response.data)
      }
    } catch (error) {
      console.error('Homepage CMS loading error:', error)

      // Existing static homepage remains the fallback.
    }
  }

  void loadHomepageBanners()

  return () => {
    cancelled = true
  }
}, [])

  // ============================================================
  // PERSISTENCE
  // ============================================================
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist))
  }, [wishlist])

  // ============================================================
  // DERIVED PRODUCTS (single source of truth)
  // ============================================================
  const filteredProducts = useMemo<Product[]>(() => {
    const query = search.trim().toLowerCase()

    const result = products.filter((product) => {
      const matchesCategory =
        activeCategory === 'All' || product.category === activeCategory

      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query)

      return matchesCategory && matchesSearch
    })

    switch (sortBy) {
      case 'price-low':
        return [...result].sort((a, b) => a.price - b.price)
      case 'price-high':
        return [...result].sort((a, b) => b.price - a.price)
      case 'name':
        return [...result].sort((a, b) => a.name.localeCompare(b.name))
      default:
        return result
    }
  }, [products, activeCategory, search, sortBy])

  // Reset external filter results when base filter changes
  // (so stale ProductFilters results don't leak into the grid)
  useEffect(() => {
    setFilterResults(null)
  }, [activeCategory, search, sortBy])

  // What actually gets rendered in the grid
  const displayProducts: Product[] = useMemo(() => {
  if (filterResults === null) {
    return filteredProducts
  }

  const idSet = new Set(filterResults.map((product) => product.id))

  return filteredProducts.filter((product) => idSet.has(product.id))
}, [filterResults, filteredProducts])

  // ============================================================
  // CART DERIVATIONS
  // ============================================================
  const cartItems = useMemo(
    () => products.filter((product) => (cart[product.id] || 0) > 0),
    [products, cart]
  )

  const cartCount = useMemo(
    () => Object.values(cart).reduce((total, qty) => total + qty, 0),
    [cart]
  )

  const subtotal = useMemo(
    () => cartItems.reduce((total, p) => total + p.price * (cart[p.id] || 0), 0),
    [cartItems, cart]
  )

  const totalSavings = useMemo(
    () =>
      cartItems.reduce(
        (total, p) =>
          total + Math.max(0, p.mrp - p.price) * (cart[p.id] || 0),
        0
      ),
    [cartItems, cart]
  )

  // ============================================================
  // ACTIONS
  // ============================================================
  const updateCart = useCallback((id: number, change: number) => {
    setCart((previous) => {
      const nextQuantity = (previous[id] || 0) + change
      const next = { ...previous }

      if (nextQuantity <= 0) {
        delete next[id]
      } else {
        next[id] = nextQuantity
      }

      return next
    })
  }, [])

  const toggleWishlist = useCallback((id: number) => {
    setWishlist((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    )
  }, [])

  const scrollToProducts = useCallback(() => {
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const selectCategory = useCallback(
    (category: string) => {
      setActiveCategory(category)
      setMobileMenuOpen(false)
      scrollToProducts()
    },
    [scrollToProducts]
  )

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    setActiveCategory('All')
  }, [])

  const handleCheckoutClick = useCallback(() => {
    setCartOpen(false)
    if (!customer) {
      setAuthOpen(true)
    } else {
      setCheckoutOpen(true)
    }
  }, [customer])

  const handleOrderSuccess = useCallback((order: { order_number: string }) => {
    setCheckoutOpen(false)
    setCart({})
    alert('Order placed successfully! Order number: ' + order.order_number)
  }, [])

  const handleLogout = useCallback(() => {
    clearCustomerSession()
    setCustomer(null)
    setAccountMenuOpen(false)
  }, [])

  const handleSelectLocation = useCallback((location: { label: string }) => {
    setSelectedLocation(location.label)
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location))
    setLocationOpen(false)
  }, [])

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="app-shell">
      <div className="announcement">
        <span>&#x2728;</span>
        Welcome to Riya Quick Commerce
      </div>
      <header className="main-header">
        <div className="header-container">
          <button
            className="mobile-menu-button icon-button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            <Menu size={23} />
          </button>

          <a href="#" className="brand-logo">
            <div className="logo-symbol">R</div>
            <div className="logo-text">
              <strong>
                RIYA<span>.</span>
              </strong>
              <small>QUICK COMMERCE</small>
            </div>
          </a>

          <button
            className="location-selector"
            onClick={() => setLocationOpen((v) => !v)}
          >
            <MapPin size={20} />
            <div>
              <small>DELIVERING TO</small>
              <strong>{selectedLocation}</strong>
            </div>
            <ChevronDown size={16} />
          </button>

          <div className="header-search">
            <SmartSearch
              value={search}
              onChange={handleSearchChange}
              products={products.map((p) => ({
                id: p.id,
                name: p.name,
                category: p.category,
              }))}
              onSubmit={scrollToProducts}
            />
          </div>

          <div className="header-actions">
            <button
              className="header-account"
              onClick={() => {
                if (customer) setAccountMenuOpen((open) => !open)
                else setAuthOpen(true)
              }}
            >
              <UserRound size={20} />
              <span>{customer ? customer.name : 'Account'}</span>
            </button>

            <button className="cart-button" onClick={() => setCartOpen(true)}>
              <ShoppingCart size={20} />
              <span>Cart</span>
              {cartCount > 0 && <b className="cart-count">{cartCount}</b>}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="mobile-menu">
            {CATEGORIES.map((category) => (
              <button
                key={category.name}
                onClick={() => selectCategory(category.name)}
              >
                {category.icon} {category.name}
              </button>
            ))}
          </div>
        )}
      </header>

      <LocationSelector
        open={locationOpen}
        onClose={() => setLocationOpen(false)}
        currentLocation={selectedLocation}
        onSelect={handleSelectLocation}
      />

      <nav className="category-nav">
        <div className="category-nav-inner">
          <button onClick={() => selectCategory('All')}>
            <Sparkles size={16} /> All products
          </button>
          <button onClick={() => selectCategory('Grocery')}>Grocery</button>
          <button onClick={() => selectCategory('Electronics')}>Electronics</button>
          <button onClick={() => selectCategory('Solar')}>Solar solutions</button>
          <button onClick={() => selectCategory('Home')}>Home & living</button>
          <button onClick={() => selectCategory('Personal Care')}>Personal care</button>
          <button onClick={() => selectCategory('Electrical')}>Electrical</button>
        </div>
      </nav>

      <main>
        {/* ---------- HERO ---------- */}
        <section
  className={`hero-section ${heroBanner?.imageUrl ? 'hero-section-cms' : ''}`}
  style={
    heroBanner?.imageUrl
      ? { backgroundImage: `url("${heroBanner.imageUrl}")` }
      : undefined
  }
>
          <div className="hero-content">
            <div className="hero-eyebrow">
              <Zap size={15} fill="currentColor" />
              ONE STORE. ENDLESS POSSIBILITIES.
            </div>

            <h1>
  {heroBanner ? (
    heroBanner.title
  ) : (
    <>
      Everything you need.
      <br />
      <span>Right at your doorstep.</span>
    </>
  )}
</h1>

            <p>
  {heroBanner?.subtitle ||
    'From daily essentials to electronics and solar solutions, discover more with Riya Quick Commerce.'}
</p>

            <div className="hero-buttons">
              <button
  className="hero-primary-button"
  onClick={() =>
    handleCmsCta(heroBanner?.ctaLink || '#products')
  }
>
  {heroBanner?.ctaText || 'Explore products'}
  <ArrowRight size={18} />
</button>
              <div className="hero-delivery-note">
                <ShieldCheck size={20} />
                <span>Trusted shopping</span>
              </div>
            </div>

            <div className="hero-stats">
              <div>
                <strong>All-in-one</strong>
                <small>Shopping destination</small>
              </div>
              <div>
                <strong>Local</strong>
                <small>Delivery network</small>
              </div>
              <div>
                <strong>Easy</strong>
                <small>Online shopping</small>
              </div>
            </div>
          </div>

          {!heroBanner?.imageUrl && (
            <div className="hero-visual">
              {heroBanner?.imageUrl && (
                <img
                  className="hero-cms-image"
                  src={heroBanner.imageUrl}
                  alt={heroBanner.title}
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                  }}
                />
              )}
              <div className="hero-circle circle-one" />
              <div className="hero-circle circle-two" />
              <div className="hero-product hero-product-one">&#x1F955;</div>
              <div className="hero-product hero-product-two">&#x1F4F1;</div>
              <div className="hero-product hero-product-three">&#x2600;&#xFE0F;</div>
              <div className="hero-product hero-product-four">&#x1F6CD;&#xFE0F;</div>
              <div className="hero-main-illustration">
                <div className="hero-shopping-bag">
                  <ShoppingBag size={90} strokeWidth={1.2} />
                  <div className="bag-items">&#x1F955; &#x1F9C3; &#x1F4E6;</div>
                </div>
              </div>

              <div className="floating-label floating-label-one">
                <Zap size={15} fill="#F7C928" />
                <span>Smart shopping</span>
              </div>

              <div className="floating-label floating-label-two">
                <ShieldCheck size={16} />
                <span>Quality products</span>
              </div>
            </div>
          )}

          <div className="hero-bottom-shape" />
        </section>

        {/* ---------- SERVICES ---------- */}
        <section className="service-strip">
          <div className="service-item">
            <div className="service-icon green"><Truck /></div>
            <div>
              <strong>Local delivery</strong>
              <small>Delivery in serviceable areas</small>
            </div>
          </div>

          <div className="service-item">
            <div className="service-icon yellow"><ShieldCheck /></div>
            <div>
              <strong>Quality products</strong>
              <small>Carefully selected products</small>
            </div>
          </div>

          <div className="service-item">
            <div className="service-icon pink"><Tag /></div>
            <div>
              <strong>Great offers</strong>
              <small>Value on selected products</small>
            </div>
          </div>

          <div className="service-item">
            <div className="service-icon blue"><Headphones /></div>
            <div>
              <strong>Customer support</strong>
              <small>We're here to help</small>
            </div>
          </div>
        </section>

        {/* ---------- CATEGORIES ---------- */}
        <section className="content-section category-section">
          <div className="section-heading">
            <div>
              <span className="section-eyebrow">EXPLORE OUR STORE</span>
              <h2>
  {promoBanner ? (
    promoBanner.title
  ) : (
    <>
      More choices.
      <br />
      More convenience.
    </>
  )}
</h2>
              <p>Find everything you need, all in one place.</p>
            </div>

            <button className="text-link" onClick={() => selectCategory('All')}>
              View all <ArrowUpRight size={17} />
            </button>
          </div>

          <div className="category-grid">
            {CATEGORIES.map((category) => (
              <button
                className={`category-card ${
                  activeCategory === category.name ? 'active' : ''
                }`}
                key={category.name}
                onClick={() => selectCategory(category.name)}
              >
                <div
                  className="category-icon"
                  style={{ backgroundColor: category.color }}
                >
                  {category.icon}
                </div>
                <strong>
                  {category.name === 'All' ? 'All products' : category.name}
                </strong>
                <ArrowUpRight size={16} className="category-arrow" />
              </button>
            ))}
          </div>
        </section>

        {/* ---------- PROMO ---------- */}
        {/* ---------- PROMO ---------- */}
<section className="promo-banner">
  <div className="promo-content">
    <span className="promo-label">DISCOVER SOMETHING NEW</span>

    <h2>
      {promoBanner ? (
        promoBanner.title
      ) : (
        <>
          More choices.
          <br />
          More convenience.
        </>
      )}
    </h2>

    <p>
      {promoBanner?.subtitle ||
        'Explore grocery, electronics, solar and everyday essentials.'}
    </p>

    <button
      onClick={() =>
        handleCmsCta(promoBanner?.ctaLink || '#products')
      }
    >
      {promoBanner?.ctaText || 'Start shopping'}
      <ArrowRight size={17} />
    </button>
  </div>

  
 <div className="promo-art">
  {promoBanner?.imageUrl ? (
    <img
      className="promo-cms-image"
      src={promoBanner.imageUrl}
      alt={promoBanner.title}
      onError={(event) => {
        event.currentTarget.style.display = 'none';
      }}
    />
  ) : (
    <>
      <div className="promo-art-circle" />
      <div className="promo-art-circle" />
      <span>&#x1F6CD;\uFE0F</span>
      <span>&#x1F6D2;</span>
      <span>&#x1F4F1;</span>
       <div className="promo-art-circle" />
       <div className="promo-art-circle" />
       <span>&#x1F6CD;&#xFE0F</span>
       <span>&#x1F6D2;</span>
       <span>&#x1F4F1;</span>
       <span>&#x2600;&#xFE0F;</span>
     </>
   )}
 </div>
</section>
         <section className="content-section products-section" id="products">
           <div className="section-heading">
             <div>
               <span className="section-eyebrow">HANDPICKED FOR YOU</span>
               <h2>
                 {search.trim()
                   ? `Search results for "${search.trim()}"`
                   : activeCategory === 'All'
                   ? 'Popular products'
                   : activeCategory}
                 <span> &#x2728;</span>
               </h2>
               <p>Discover products worth adding to your cart.</p>
             </div>

             <div className="product-heading-right">
               <span className="product-count">
                 {displayProducts.length} products
               </span>

               <select
                 className="sort-select"
                 value={sortBy}
                 onChange={(e) => setSortBy(e.target.value as SortOption)}
                 aria-label="Sort products"
               >
                 <option value="recommended">Recommended</option>
                 <option value="price-low">Price: Low to High</option>
                 <option value="price-high">Price: High to Low</option>
               </select>
             </div>
           </div>
            <div className="product-filter-bar">
              {CATEGORIES.map((category) => (
                <button
                  key={category.name}
                  className={
                    activeCategory === category.name ? 'filter-active' : ''
                  }
                  onClick={() => setActiveCategory(category.name)}
                >
                  {category.icon} {category.name}
                </button>
              ))}
            </div>

            <ProductFilters
              products={filteredProducts}
              onFilterChange={(filtered) => setFilterResults(filtered)}
            />

          {loading ? (
            <div className="empty-products">
              <Package size={45} />
              <h3>Loading products...</h3>
              <p>Connecting to Riya Quick Commerce store.</p>
            </div>
          ) : apiError ? (
            <div className="empty-products">
              <Package size={45} />
              <h3>Unable to load products</h3>
              <p>{apiError}</p>
              <button className="primary-button" onClick={() => void loadProducts()}>
                <RefreshCw size={16} /> Retry connection
              </button>
            </div>
          ) : displayProducts.length > 0 ? (
            <div className="product-grid">
              {displayProducts.map((product) => {
                const isWishlisted = wishlist.includes(product.id)
                const qty = cart[product.id] || 0

                return (
                  <article
                    className="product-card"
                    key={product.id}
                    onClick={() => navigate(`/product/${product.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="product-image-wrap">
                      <img
                        src={product.image}
                        alt={product.name}
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.src = DEFAULT_FALLBACK_IMAGE
                        }}
                      />

                      {product.tag && (
                        <span className="product-tag">{product.tag}</span>
                      )}

                      <button
                        type="button"
                        className={`wishlist-button ${
                          isWishlisted ? 'wishlisted' : ''
                        }`}
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleWishlist(product.id)
                        }}
                        aria-label={
                          isWishlisted
                            ? 'Remove from wishlist'
                            : 'Add to wishlist'
                        }
                        title={
                          isWishlisted
                            ? 'Remove from wishlist'
                            : 'Add to wishlist'
                        }
                      >
                        <Heart
                          size={21}
                          strokeWidth={2}
                          fill={isWishlisted ? 'currentColor' : 'none'}
                        />
                      </button>
                    </div>

                    <div className="product-information">
                      {product.rating > 0 && (
                        <div className="product-rating">
                          <Star size={12} fill="currentColor" />
                          {product.rating}
                        </div>
                      )}

                      <h3>{product.name}</h3>
                      <p>{product.description}</p>
                      <div className="product-unit">{product.unit}</div>

                      <div className="product-bottom">
                        <div className="product-price">
                          <strong>{formatPrice(product.price)}</strong>
                          {product.mrp > product.price && (
                            <del>{formatPrice(product.mrp)}</del>
                          )}
                        </div>

                        {qty === 0 ? (
                          <button
                            className="add-button"
                            onClick={(event) => {
                              event.stopPropagation()
                              updateCart(product.id, 1)
                            }}
                          >
                            ADD <Plus size={15} />
                          </button>
                        ) : (
                          <div className="quantity-control">
                            <button
                              onClick={(event) => {
                                event.stopPropagation()
                                updateCart(product.id, -1)
                              }}
                            >
                              <Minus size={14} />
                            </button>
                            <strong>{qty}</strong>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                updateCart(product.id, 1)
                              }}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="empty-products">
              <Package size={45} />
              <h3>No products found</h3>
              <p>Try a different search or category.</p>
              <button
                className="primary-button"
                onClick={() => {
                  setSearch('')
                  setActiveCategory('All')
                  setSortBy('recommended')
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </section>

        {/* ---------- DEALS ---------- */}
        <section className="deal-section">
          <div className="deal-content">
            <div>
              <span className="section-eyebrow">SPECIAL SELECTION</span>
              <h2>
                Deals you'll love <Zap size={25} fill="currentColor" />
              </h2>
              <p>Explore selected products and exciting savings.</p>
            </div>

            <button
              className="deal-explore-button"
              onClick={() => {
                setActiveCategory('All')
                setSearch('')
                scrollToProducts()
              }}
            >
              Explore deals <ArrowRight size={17} />
            </button>
          </div>

          <div className="deal-cards">
            <div className="deal-card deal-card-one">
              <div>
                <span>FRESH FINDS</span>
                <h3>
                  Everyday
                  <br />
                  essentials
                </h3>
                <p>Shop your daily favourites.</p>
                <button onClick={() => selectCategory('Grocery')}>
                  Explore <ArrowRight size={15} />
                </button>
              </div>
              </div>
              <span className="deal-emoji">&#x1F955;</span>

            <div className="deal-card deal-card-two">
              <div>
                <span>POWER YOUR HOME</span>
                <h3>
                  Solar &
                  <br />
                  electronics
                </h3>
                <p>Explore smarter solutions.</p>
                <button onClick={() => selectCategory('Solar')}>
                  Explore <ArrowRight size={15} />
                </button>
              </div>
              </div>
              <span className="deal-emoji">&#x2600;&#xFE0F;</span>

            <div className="deal-card deal-card-three">
              <div>
                <span>HOME & LIVING</span>
                <h3>
                  Make life
                  <br />
                  easier
                </h3>
                <p>Find useful everyday products.</p>
                <button onClick={() => selectCategory('Home')}>
                  Explore <ArrowRight size={15} />
                </button>
              </div>
              </div>
              <span className="deal-emoji">&#x1F4E6;</span>
          </div>
        </section>

        {/* ---------- TRUST ---------- */}
        <section className="trust-section">
          <div>
            <div className="trust-icon"><ShieldCheck size={30} /></div>
            <h3>Shopping made simple</h3>
            <p>Explore products, compare options and shop conveniently from one place.</p>
          </div>
          <div>
            <div className="trust-icon"><Truck size={30} /></div>
            <h3>Local delivery network</h3>
            <p>Delivery availability and timing based on your serviceable location.</p>
          </div>
          <div>
            <div className="trust-icon"><Headphones size={30} /></div>
            <h3>Customer first</h3>
            <p>Support and assistance whenever you need help with an order.</p>
          </div>
        </section>
      </main>

      {/* ---------- FOOTER ---------- */}
      <footer className="main-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <a href="#" className="brand-logo footer-logo">
              <div className="logo-symbol">R</div>
              <div className="logo-text">
                <strong>
                  RIYA<span>.</span>
                </strong>
                <small>QUICK COMMERCE</small>
              </div>
            </a>
            <p>
              Your destination for grocery, electronics, solar solutions and
              everyday essentials.
            </p>
          </div>

          <div className="footer-column">
            <h4>Explore</h4>
            <a href="#products">Products</a>
            <a href="#products">Categories</a>
            <a href="#products">Special offers</a>
            <a href="#products">New arrivals</a>
          </div>

          <div className="footer-column">
            <h4>Customer care</h4>
            <a href="#support">Contact us</a>
            <a href="#support">Help centre</a>
            <a href="#support">Shipping policy</a>
            <a href="#support">Returns & refunds</a>
          </div>

          <div className="footer-column">
            <h4>About Riya</h4>
            <a href="#about">About us</a>
            <a href="#about">Privacy policy</a>
            <a href="#about">Terms & conditions</a>
            <a href="#about">Business enquiries</a>
          </div>

          <div className="footer-newsletter">
            <h4>Stay connected</h4>
            <p>Get updates about products and offers.</p>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                alert('Newsletter subscription will be connected to the backend.')
              }}
            >
              <input type="email" placeholder="Your email address" required />
              <button aria-label="Subscribe">
                <ArrowRight size={18} />
              </button>
            </form>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&#x00A9; {new Date().getFullYear()} Riya Quick Commerce. All rights reserved.</p>
            <span>Made for everyday convenience</span>
            <span>India &#x1F1EE;&#x1F1F3;</span>
        </div>
      </footer>

      {/* ---------- CART DRAWER ---------- */}
      {cartOpen && (
        <div className="drawer-overlay" onClick={() => setCartOpen(false)}>
          <aside
            className="cart-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <h2>Your cart</h2>
                <small>{cartCount} items</small>
              </div>
              <button onClick={() => setCartOpen(false)} aria-label="Close cart">
                <X size={22} />
              </button>
            </div>

            {cartItems.length === 0 ? (
              <div className="empty-cart">
                <div className="empty-cart-icon">
                  <ShoppingCart size={48} />
                </div>
                <h3>Your cart is empty</h3>
                <p>Add products to start shopping.</p>
                <button
                  className="primary-button"
                  onClick={() => setCartOpen(false)}
                >
                  Explore products
                </button>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cartItems.map((product) => (
                    <div className="cart-item" key={product.id}>
                      <img src={product.image} alt={product.name} />
                      <div className="cart-item-info">
                        <strong>{product.name}</strong>
                        <small>{product.unit}</small>
                        <b>{formatPrice(product.price * (cart[product.id] || 0))}</b>
                      </div>
                      <div className="quantity-control">
                        <button onClick={() => updateCart(product.id, -1)}>
                          <Minus size={13} />
                        </button>
                        <strong>{cart[product.id]}</strong>
                        <button onClick={() => updateCart(product.id, 1)}>
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="cart-summary">
                  <div>
                    <span>Subtotal</span>
                    <strong>{formatPrice(subtotal)}</strong>
                  </div>
                  <div>
                    <span>Product savings</span>
                    <strong className="savings-text">
                      -{formatPrice(totalSavings)}
                    </strong>
                  </div>
                  <div>
                    <span>Delivery charge</span>
                    <strong>Calculated at checkout</strong>
                  </div>
                  <div className="cart-total">
                    <span>Items total</span>
                    <strong>{formatPrice(subtotal)}</strong>
                  </div>
                  <button className="checkout-button" onClick={handleCheckoutClick}>
                    Continue to checkout <ArrowRight size={18} />
                  </button>
                  <small>Final payable amount will be calculated at checkout.</small>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {/* ---------- MODALS ---------- */}
      {authOpen && (
        <CustomerAuth
          onClose={() => setAuthOpen(false)}
          onSuccess={(loggedInCustomer) => {
            setCustomer(loggedInCustomer)
            setAccountMenuOpen(false)
          }}
        />
      )}

      {checkoutOpen && customer && (
        <CustomerCheckout
          customer={customer}
          items={cartItems.map((product) => ({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: cart[product.id] || 0,
          }))}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={handleOrderSuccess}
        />
      )}

            {profileOpen && customer && (
        <CustomerProfile
          customer={customer}
          onClose={() => setProfileOpen(false)}
          onCustomerUpdated={(updatedCustomer) => {
            setCustomer(updatedCustomer)
          }}
        />
      )}
      {myOrdersOpen && customer && (
        <MyOrders customer={customer} onClose={() => setMyOrdersOpen(false)} />
      )}

            {accountMenuOpen && customer && (
        <div className="customer-account-menu">
          <strong>{customer.name}</strong>
          <small>{customer.email}</small>

          <button
            onClick={() => {
              setAccountMenuOpen(false)
              setProfileOpen(true)
            }}
          >
            <UserRound size={16} /> My Profile
          </button>

          <button
            onClick={() => {
              setAccountMenuOpen(false)
              setMyOrdersOpen(true)
            }}
          >
            <Package size={16} /> My Orders
          </button>

          <button onClick={handleLogout}>Logout</button>
        </div>
      )}
    </div>
  )
}

export default App

