
import { useEffect, useMemo, useState } from 'react'
import {
  SlidersHorizontal,
  X,
  ChevronDown,
  ArrowUpDown,
  Check,
} from 'lucide-react'
import './ProductFilters.css'

export type ProductFilterItem = {
  id: number | string
  name: string
  category: string
  price: number
  inStock?: boolean
}

export type ProductFilterState = {
  category: string
  minPrice: number
  maxPrice: number
  availability: 'all' | 'in-stock'
  sort: 'recommended' | 'price-low' | 'price-high' | 'name'
}

type ProductFiltersProps = {
  products: ProductFilterItem[]
  onFilterChange: (filteredProducts: ProductFilterItem[]) => void
  onStateChange?: (state: ProductFilterState) => void
}

const DEFAULT_FILTERS: ProductFilterState = {
  category: 'All',
  minPrice: 0,
  maxPrice: 100000,
  availability: 'all',
  sort: 'recommended',
}

export default function ProductFilters({
  products,
  onFilterChange,
  onStateChange,
}: ProductFiltersProps) {
  const [filters, setFilters] = useState<ProductFilterState>(
    DEFAULT_FILTERS
  )
  const [mobileOpen, setMobileOpen] = useState(false)

  const categories = useMemo(() => {
    return [
      'All',
      ...Array.from(
        new Set(products.map((product) => product.category).filter(Boolean))
      ),
    ]
  }, [products])

  const priceLimit = useMemo(() => {
    const prices = products.map((product) => Number(product.price) || 0)
    return Math.max(1000, ...prices)
  }, [products])

  const effectiveMaxPrice = Math.min(filters.maxPrice, priceLimit)

  const filteredProducts = useMemo(() => {
    let result = [...products]

    if (filters.category !== 'All') {
      result = result.filter(
        (product) => product.category === filters.category
      )
    }

    result = result.filter((product) => {
      const price = Number(product.price) || 0
      return price >= filters.minPrice && price <= effectiveMaxPrice
    })

    if (filters.availability === 'in-stock') {
      result = result.filter((product) => product.inStock !== false)
    }

    if (filters.sort === 'price-low') {
      result.sort((a, b) => a.price - b.price)
    } else if (filters.sort === 'price-high') {
      result.sort((a, b) => b.price - a.price)
    } else if (filters.sort === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name))
    }

    return result
  }, [products, filters, effectiveMaxPrice])

  const updateFilters = (next: ProductFilterState) => {
    setFilters(next)
    onStateChange?.(next)
  }

  const resetFilters = () => {
    const reset: ProductFilterState = {
      ...DEFAULT_FILTERS,
      maxPrice: priceLimit,
    }

    updateFilters(reset)
  }

  const activeCount = [
    filters.category !== 'All',
    filters.minPrice > 0,
    effectiveMaxPrice < priceLimit,
    filters.availability !== 'all',
    filters.sort !== 'recommended',
  ].filter(Boolean).length

  useEffect(() => {
    onFilterChange(filteredProducts)
  }, [filteredProducts, onFilterChange])

  return (
    <section className="product-filters">
      <div className="product-filters-top">
        <div className="product-filters-title">
          <SlidersHorizontal size={18} />
          <strong>Filter &amp; Sort</strong>

          {activeCount > 0 && (
            <span className="product-filter-count">{activeCount}</span>
          )}
        </div>

        <button
          type="button"
          className="product-filter-mobile-toggle"
          onClick={() => setMobileOpen((value) => !value)}
          aria-expanded={mobileOpen}
        >
          <SlidersHorizontal size={16} />
          Filters
          <ChevronDown
            size={15}
            className={mobileOpen ? 'rotated' : ''}
          />
        </button>

        <div className="product-filter-result-count">
          Showing <strong>{filteredProducts.length}</strong> products
        </div>
      </div>

      <div className={`product-filters-panel ${mobileOpen ? 'open' : ''}`}>
        <div className="product-filter-field">
          <label htmlFor="product-category">Category</label>

          <select
            id="product-category"
            value={filters.category}
            onChange={(event) =>
              updateFilters({
                ...filters,
                category: event.target.value,
              })
            }
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="product-filter-field product-price-field">
          <label>Price range</label>

          <div className="product-price-inputs">
            <input
              type="number"
              min={0}
              max={effectiveMaxPrice}
              value={filters.minPrice}
              aria-label="Minimum price"
              onChange={(event) => {
                const value = Math.max(
                  0,
                  Number(event.target.value) || 0
                )

                updateFilters({
                  ...filters,
                  minPrice: Math.min(value, effectiveMaxPrice),
                })
              }}
            />

            <span>to</span>

            <input
              type="number"
              min={filters.minPrice}
              max={priceLimit}
              value={effectiveMaxPrice}
              aria-label="Maximum price"
              onChange={(event) =>
                updateFilters({
                  ...filters,
                  maxPrice: Math.min(
                    priceLimit,
                    Math.max(
                      filters.minPrice,
                      Number(event.target.value) || 0
                    )
                  ),
                })
              }
            />
          </div>

          <input
            className="product-price-range"
            type="range"
            min={0}
            max={priceLimit}
            value={effectiveMaxPrice}
            aria-label="Maximum price slider"
            onChange={(event) =>
              updateFilters({
                ...filters,
                maxPrice: Math.max(
                  filters.minPrice,
                  Number(event.target.value)
                ),
              })
            }
          />
        </div>

        <div className="product-filter-field">
          <label htmlFor="product-availability">Availability</label>

          <select
            id="product-availability"
            value={filters.availability}
            onChange={(event) =>
              updateFilters({
                ...filters,
                availability: event.target.value as ProductFilterState['availability'],
              })
            }
          >
            <option value="all">All products</option>
            <option value="in-stock">In stock only</option>
          </select>
        </div>

        <div className="product-filter-field">
          <label htmlFor="product-sort">Sort by</label>

          <div className="product-sort-select">
            <ArrowUpDown size={15} />

            <select
              id="product-sort"
              value={filters.sort}
              onChange={(event) =>
                updateFilters({
                  ...filters,
                  sort: event.target.value as ProductFilterState['sort'],
                })
              }
            >
              <option value="recommended">Recommended</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="name">Name: A to Z</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          className="product-filter-reset"
          onClick={resetFilters}
        >
          <X size={15} />
          Reset
        </button>
      </div>

      {activeCount > 0 && (
        <div className="product-filter-active">
          <span>Active filters:</span>

          {filters.category !== 'All' && (
            <span className="product-filter-chip">
              {filters.category}

              <button
                type="button"
                aria-label="Remove category filter"
                onClick={() =>
                  updateFilters({
                    ...filters,
                    category: 'All',
                  })
                }
              >
                <X size={12} />
              </button>
            </span>
          )}

          {filters.minPrice > 0 && (
            <span className="product-filter-chip">
              Min: ₹{filters.minPrice.toLocaleString('en-IN')}

              <button
                type="button"
                aria-label="Remove minimum price filter"
                onClick={() =>
                  updateFilters({
                    ...filters,
                    minPrice: 0,
                  })
                }
              >
                <X size={12} />
              </button>
            </span>
          )}

          {effectiveMaxPrice < priceLimit && (
            <span className="product-filter-chip">
              Max: ₹{effectiveMaxPrice.toLocaleString('en-IN')}

              <button
                type="button"
                aria-label="Remove maximum price filter"
                onClick={() =>
                  updateFilters({
                    ...filters,
                    maxPrice: priceLimit,
                  })
                }
              >
                <X size={12} />
              </button>
            </span>
          )}

          {filters.availability === 'in-stock' && (
            <span className="product-filter-chip">
              In stock

              <button
                type="button"
                aria-label="Remove availability filter"
                onClick={() =>
                  updateFilters({
                    ...filters,
                    availability: 'all',
                  })
                }
              >
                <X size={12} />
              </button>
            </span>
          )}

          {filters.sort !== 'recommended' && (
            <span className="product-filter-chip">
              {filters.sort === 'price-low'
                ? 'Price: Low to High'
                : filters.sort === 'price-high'
                  ? 'Price: High to Low'
                  : 'Name: A to Z'}

              <button
                type="button"
                aria-label="Remove sorting"
                onClick={() =>
                  updateFilters({
                    ...filters,
                    sort: 'recommended',
                  })
                }
              >
                <X size={12} />
              </button>
            </span>
          )}

          <span className="product-filter-chip">
            <Check size={12} />
            {activeCount} active
          </span>
        </div>
      )}
    </section>
  )
}
