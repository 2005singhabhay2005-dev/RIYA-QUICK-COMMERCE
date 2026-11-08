
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  X,
  Clock3,
  TrendingUp,
  ArrowUpRight,
  Trash2,
} from 'lucide-react'
import './SmartSearch.css'

type SmartSearchProps = {
  value: string
  onChange: (value: string) => void
  products: {
    id: number
    name: string
    category: string
  }[]
  onSubmit?: (value: string) => void
}

const TRENDING_SEARCHES = [
  'Solar panel',
  'Mobile accessories',
  'Rice',
  'LED light',
  'Home essentials',
  'Inverter',
]

const RECENT_SEARCH_KEY = 'riya-recent-searches'

function getRecentSearches(): string[] {
  try {
    const saved = JSON.parse(
      localStorage.getItem(RECENT_SEARCH_KEY) || '[]'
    )

    return Array.isArray(saved)
      ? saved.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

export default function SmartSearch({
  value,
  onChange,
  products,
  onSubmit,
}: SmartSearchProps) {
  const [open, setOpen] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>(
    getRecentSearches
  )

  const wrapperRef = useRef<HTMLDivElement>(null)

  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase()

    if (!query) return []

    const matches = products
      .filter((product) =>
        `${product.name} ${product.category}`.toLowerCase().includes(query)
      )
      .slice(0, 6)

    return matches
  }, [products, value])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  const saveSearch = (search: string) => {
    const cleaned = search.trim()

    if (!cleaned) return

    const updated = [
      cleaned,
      ...recentSearches.filter(
        (item) => item.toLowerCase() !== cleaned.toLowerCase()
      ),
    ].slice(0, 7)

    setRecentSearches(updated)

    localStorage.setItem(
      RECENT_SEARCH_KEY,
      JSON.stringify(updated)
    )

    onChange(cleaned)
    onSubmit?.(cleaned)
    setOpen(false)
  }

  const clearRecentSearches = () => {
    setRecentSearches([])
    localStorage.removeItem(RECENT_SEARCH_KEY)
  }

  return (
    <div className="smart-search" ref={wrapperRef}>
      <div className={`smart-search-input ${open ? 'is-open' : ''}`}>
        <Search size={20} />

        <input
          type="search"
          value={value}
          placeholder="Search groceries, electronics, solar products..."
          aria-label="Search products"
          aria-expanded={open}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value)
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              saveSearch(value)
            }

            if (event.key === 'Escape') {
              setOpen(false)
            }
          }}
        />

        {value && (
          <button
            type="button"
            className="smart-search-clear"
            onClick={() => {
              onChange('')
              setOpen(true)
            }}
            aria-label="Clear search"
          >
            <X size={17} />
          </button>
        )}
      </div>

      {open && (
        <div className="smart-search-dropdown">
          {value.trim() ? (
            <>
              <div className="smart-search-heading">
                <span>SEARCH SUGGESTIONS</span>
                <small>{suggestions.length} matches</small>
              </div>

              {suggestions.length > 0 ? (
                suggestions.map((product) => (
                  <button
                    type="button"
                    className="smart-search-option"
                    key={product.id}
                    onClick={() => saveSearch(product.name)}
                  >
                    <span className="smart-search-option-icon">
                      <Search size={16} />
                    </span>

                    <span className="smart-search-option-text">
                      <strong>{product.name}</strong>
                      <small>{product.category}</small>
                    </span>

                    <ArrowUpRight size={16} />
                  </button>
                ))
              ) : (
                <div className="smart-search-empty">
                  <Search size={22} />
                  <strong>No matching products found</strong>
                  <span>Try another product name or category.</span>
                </div>
              )}

              <button
                type="button"
                className="smart-search-all"
                onClick={() => saveSearch(value)}
              >
                Search for "{value}"
                <ArrowUpRight size={16} />
              </button>
            </>
          ) : (
            <>
              {recentSearches.length > 0 && (
                <div className="smart-search-group">
                  <div className="smart-search-heading">
                    <span>
                      <Clock3 size={14} /> RECENT SEARCHES
                    </span>

                    <button
                      type="button"
                      onClick={clearRecentSearches}
                    >
                      <Trash2 size={13} /> Clear
                    </button>
                  </div>

                  {recentSearches.map((item) => (
                    <button
                      type="button"
                      className="smart-search-option"
                      key={item}
                      onClick={() => saveSearch(item)}
                    >
                      <span className="smart-search-option-icon">
                        <Clock3 size={16} />
                      </span>
                      <span className="smart-search-option-text">
                        <strong>{item}</strong>
                      </span>
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
                </div>
              )}

              <div className="smart-search-group">
                <div className="smart-search-heading">
                  <span>
                    <TrendingUp size={14} /> TRENDING SEARCHES
                  </span>
                </div>

                <div className="smart-search-trending">
                  {TRENDING_SEARCHES.map((item) => (
                    <button
                      type="button"
                      key={item}
                      onClick={() => saveSearch(item)}
                    >
                      <TrendingUp size={13} />
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
