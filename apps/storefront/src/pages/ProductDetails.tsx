
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, ShoppingCart, Plus, Minus, Star,
  ShieldCheck, Truck, Package, RefreshCw
} from 'lucide-react'
import {
  getProductDetails,
  type ProductDetailsData
} from '../services/api'

const API_ORIGIN = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
).replace(/\/api\/?$/, '')

function imageUrl(value: string) {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `${API_ORIGIN}${value.startsWith('/') ? '' : '/'}${value}`
}

const money = (value: number) =>
  `₹${Number(value || 0).toLocaleString('en-IN')}`

export default function ProductDetails() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [details, setDetails] = useState<ProductDetailsData | null>(null)
  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      try {
        setLoading(true)
        setError('')

        const productId = Number(id)
        if (!Number.isInteger(productId) || productId <= 0) {
          throw new Error('Invalid product ID.')
        }

        const response = await getProductDetails(productId)

        if (!response.success || !response.data?.product) {
          throw new Error(response.message || 'Product not found.')
        }

        if (active) {
          setDetails(response.data)
          setSelectedImage(0)
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : 'Unable to load product.'
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [id])

  if (loading) {
    return <div className="pd-status"><RefreshCw /> Loading product details...</div>
  }

  if (error || !details) {
    return (
      <div className="pd-status">
        <Package size={42} />
        <h2>Product unavailable</h2>
        <p>{error || 'This product could not be found.'}</p>
        <button onClick={() => navigate('/')}>Back to shopping</button>
      </div>
    )
  }

  const product = details.product
  const images = details.images.length
    ? details.images
    : [{ id: null, imageUrl: product.imageUrl, altText: product.name, sortOrder: 0, isPrimary: 1 }]

  const currentImage = images[selectedImage] || images[0]
  const discount = product.originalPrice && product.originalPrice > product.price
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0

  return (
    <div className="product-details-page">
      <header className="pd-header">
        <Link to="/" className="pd-brand">
          <span className="pd-logo">R</span>
          <span>RIYA<small> QUICK COMMERCE</small></span>
        </Link>
        <button className="pd-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> Back
        </button>
      </header>

      <main className="pd-container">
        <div className="pd-breadcrumb">
          <Link to="/">Home</Link> / {product.category} / {product.name}
        </div>

        <section className="pd-product-layout">
          <div className="pd-gallery">
            <div className="pd-main-image">
              <img
                src={imageUrl(currentImage.imageUrl)}
                alt={currentImage.altText || product.name}
                onError={(event) => {
                  event.currentTarget.style.visibility = 'hidden'
                }}
              />
              {discount > 0 && <span className="pd-discount">{discount}% OFF</span>}
            </div>

            {images.length > 1 && (
              <div className="pd-thumbnails">
                {images.map((image, index) => (
                  <button
                    key={`${image.id ?? 'legacy'}-${index}`}
                    className={selectedImage === index ? 'active' : ''}
                    onClick={() => setSelectedImage(index)}
                  >
                    <img src={imageUrl(image.imageUrl)} alt={image.altText || product.name} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pd-information">
            <span className="pd-category">{product.category}</span>
            <h1>{product.name}</h1>
            <p className="pd-description">{product.description}</p>

            <div className="pd-rating">
              <Star size={17} fill="currentColor" />
              <strong>{details.rating.averageRating.toFixed(1)}</strong>
              <span>{details.rating.reviewCount} verified review(s)</span>
            </div>

            <div className="pd-price">
              <strong>{money(product.price)}</strong>
              {product.originalPrice && product.originalPrice > product.price && (
                <del>{money(product.originalPrice)}</del>
              )}
            </div>

            <p className={product.stock > 0 ? 'pd-stock available' : 'pd-stock unavailable'}>
              {product.stock > 0 ? `${product.stock} units available` : 'Currently out of stock'}
            </p>

            <div className="pd-actions">
              <div className="pd-quantity">
                <button disabled={quantity <= 1} onClick={() => setQuantity(q => q - 1)}>
                  <Minus size={16} />
                </button>
                <strong>{quantity}</strong>
                <button
                  disabled={quantity >= product.stock}
                  onClick={() => setQuantity(q => q + 1)}
                >
                  <Plus size={16} />
                </button>
              </div>

              <button
                className="pd-add-button"
                disabled={product.stock <= 0}
              onClick={() => {
  try {
    const savedCart = JSON.parse(
      localStorage.getItem('riya-cart') || '{}'
    ) as Record<number, number>

    savedCart[product.id] = (savedCart[product.id] || 0) + quantity

    localStorage.setItem('riya-cart', JSON.stringify(savedCart))

    alert(`${product.name} added to cart successfully!`)
    navigate('/')
  } catch {
    alert('Unable to add product to cart. Please try again.')
  }
}}
              >
                <ShoppingCart size={19} />
                Add to cart
              </button>
            </div>

            <div className="pd-benefits">
              <div><ShieldCheck /> Quality products</div>
              <div><Truck /> Local delivery</div>
              <div><Package /> Secure packaging</div>
            </div>
          </div>
        </section>

        <section className="pd-section">
          <h2>Product specifications</h2>
          {details.specifications.length ? (
            <div className="pd-specifications">
              {details.specifications.map(spec => (
                <div key={spec.id}>
                  <strong>{spec.name}</strong>
                  <span>{spec.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="pd-muted">Specifications have not been added yet.</p>
          )}
        </section>

        <section className="pd-section">
          <h2>Customer reviews</h2>
          <div className="pd-review-summary">
            <strong>{details.rating.averageRating.toFixed(1)} / 5</strong>
            <span>{details.rating.reviewCount} approved review(s)</span>
          </div>

          {details.reviews.length ? (
            <div className="pd-reviews">
              {details.reviews.map(review => (
                <article key={review.id}>
                  <div className="pd-review-heading">
                    <strong>{review.customerName}</strong>
                    <span><Star size={14} fill="currentColor" /> {review.rating}/5</span>
                  </div>
                  <h3>{review.title}</h3>
                  <p>{review.reviewText}</p>
                  {review.adminReply && (
                    <div className="pd-admin-reply">
                      <strong>Riya team response</strong>
                      <p>{review.adminReply}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="pd-muted">No approved customer reviews yet.</p>
          )}
        </section>

        {details.recommendations.length > 0 && (
          <section className="pd-section">
            <h2>Recommended products</h2>
            <div className="pd-recommendations">
              {details.recommendations.map(item => (
                <Link to={`/product/${item.id}`} key={item.id}>
                  <img src={imageUrl(item.imageUrl)} alt={item.name} />
                  <strong>{item.name}</strong>
                  <span>{money(item.price)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
