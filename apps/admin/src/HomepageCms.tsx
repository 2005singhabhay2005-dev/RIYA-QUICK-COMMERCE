import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Plus, Pencil, Trash2, RefreshCw, Image as ImageIcon,
  Eye, EyeOff, Globe, Save, X, Monitor,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

type Banner = {
  id: number;
  title: string;
  subtitle: string;
  imageUrl: string;
  bannerType: 'hero' | 'promo';
  ctaText: string;
  ctaLink: string;
  sortOrder: number;
  isActive: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

type BannerForm = {
  title: string;
  subtitle: string;
  imageUrl: string;
  bannerType: 'hero' | 'promo';
  ctaText: string;
  ctaLink: string;
  sortOrder: string;
  isActive: boolean;
  isPublished: boolean;
};

const emptyForm: BannerForm = {
  title: '',
  subtitle: '',
  imageUrl: '',
  bannerType: 'hero',
  ctaText: 'Explore now',
  ctaLink: '#products',
  sortOrder: '0',
  isActive: true,
  isPublished: false,
};

async function request<T>(
  endpoint: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.message || `Request failed (${response.status})`);
  }

  return result as T;
}

export default function HomepageCms({ token }: { token: string }) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [draggedBannerId, setDraggedBannerId] = useState<number | null>(null);
const [reordering, setReordering] = useState(false);
  const [form, setForm] = useState<BannerForm>(emptyForm);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState<'all' | 'hero' | 'promo'>('all');
  const [uploadingImage, setUploadingImage] = useState(false);

  const loadBanners = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await request<{ success: boolean; data: Banner[] }>(
        '/homepage-cms/admin/banners',
        token,
      );
      setBanners(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load banners.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadBanners();
  }, [loadBanners]);
  async function handleBannerImageUpload(file?: File) {
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    setError('Image size must be 5 MB or less.');
    return;
  }

  setError('');
  setSuccess('');
  setUploadingImage(true);

  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch(
      `${API_URL}/homepage-cms/admin/upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      },
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Image upload failed.');
    }

    setForm((current) => ({
      ...current,
      imageUrl: `${API_ORIGIN}${result.data.imageUrl}`,
    }));

    setSuccess('Banner image uploaded successfully.');
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Image upload failed.');
  } finally {
    setUploadingImage(false);
  }
}

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
    setError('');
    setSuccess('');
  }

  function openEdit(banner: Banner) {
    setEditing(banner);
    setForm({
      title: banner.title,
      subtitle: banner.subtitle || '',
      imageUrl: banner.imageUrl || '',
      bannerType: banner.bannerType,
      ctaText: banner.ctaText || 'Explore now',
      ctaLink: banner.ctaLink || '#products',
      sortOrder: String(banner.sortOrder ?? 0),
      isActive: banner.isActive,
      isPublished: banner.isPublished,
    });
    setFormOpen(true);
    setError('');
    setSuccess('');
  }
  
  
  


function handleBannerDrop(targetBannerId: number) {
  if (
    draggedBannerId === null ||
    draggedBannerId === targetBannerId
  ) {
    return;
  }

  const currentIndex = visibleBanners.findIndex(
    (banner) => banner.id === draggedBannerId,
  );

  const targetIndex = visibleBanners.findIndex(
    (banner) => banner.id === targetBannerId,
  );

  if (currentIndex === -1 || targetIndex === -1) {
    return;
  }

  const reorderedVisible = [...visibleBanners];
  const [movedBanner] = reorderedVisible.splice(currentIndex, 1);

  reorderedVisible.splice(targetIndex, 0, movedBanner);

  const visibleIds = new Set(
    reorderedVisible.map((banner) => banner.id),
  );

  const nextBanners = [
    ...reorderedVisible,
    ...banners.filter((banner) => !visibleIds.has(banner.id)),
  ];

  void saveBannerOrder(nextBanners);
}
async function saveBannerOrder(nextBanners: Banner[]) {
  setReordering(true);
  setError('');
  setSuccess('');

  try {
    const orderedBanners = nextBanners.map((banner, position) => ({
      ...banner,
      sortOrder: position,
    }));

    for (const banner of orderedBanners) {
      await request(
        `/homepage-cms/admin/banners/${banner.id}`,
        token,
        {
          method: 'PUT',
          body: JSON.stringify({
            title: banner.title,
            subtitle: banner.subtitle,
            imageUrl: banner.imageUrl,
            bannerType: banner.bannerType,
            ctaText: banner.ctaText,
            ctaLink: banner.ctaLink,
            sortOrder: banner.sortOrder,
            isActive: banner.isActive,
            isPublished: banner.isPublished,
          }),
        },
      );
    }

    setBanners(orderedBanners);
    setSuccess('Banner order saved successfully.');
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : 'Unable to save banner order.',
    );

    await loadBanners();
  } finally {
    setReordering(false);
    setDraggedBannerId(null);
  }
}

  async function saveBanner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.title.trim()) {
      setError('Banner title is required.');
      return;
    }

    setSaving(true);

    const payload = {
      ...form,
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      imageUrl: form.imageUrl.trim(),
      ctaText: form.ctaText.trim(),
      ctaLink: form.ctaLink.trim(),
      sortOrder: Number(form.sortOrder) || 0,
    };

    try {
      if (editing) {
        await request(
          `/homepage-cms/admin/banners/${editing.id}`,
          token,
          { method: 'PUT', body: JSON.stringify(payload) },
        );
        setSuccess('Banner updated successfully.');
      } else {
        await request(
          '/homepage-cms/admin/banners',
          token,
          { method: 'POST', body: JSON.stringify(payload) },
        );
        setSuccess('Banner created successfully.');
      }

      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await loadBanners();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save banner.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleBanner(banner: Banner, field: 'isActive' | 'isPublished') {
    setError('');
    setSuccess('');

    const payload = {
      title: banner.title,
      subtitle: banner.subtitle,
      imageUrl: banner.imageUrl,
      bannerType: banner.bannerType,
      ctaText: banner.ctaText,
      ctaLink: banner.ctaLink,
      sortOrder: banner.sortOrder,
      isActive: field === 'isActive' ? !banner.isActive : banner.isActive,
      isPublished: field === 'isPublished' ? !banner.isPublished : banner.isPublished,
    };

    try {
      await request(
        `/homepage-cms/admin/banners/${banner.id}`,
        token,
        { method: 'PUT', body: JSON.stringify(payload) },
      );
      setSuccess('Banner status updated.');
      await loadBanners();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update banner.');
    }
  }

  async function deleteBanner(banner: Banner) {
    const confirmed = window.confirm(
      `Delete "${banner.title}" permanently? This action cannot be undone.`,
    );

    if (!confirmed) return;

    setError('');
    setSuccess('');

    try {
      await request(
        `/homepage-cms/admin/banners/${banner.id}`,
        token,
        { method: 'DELETE' },
      );
      setSuccess('Banner deleted.');
      await loadBanners();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete banner.');
    }
  }

  const visibleBanners = banners.filter(
    (banner) => filter === 'all' || banner.bannerType === filter,
  );

  return (
    <section className="page-section homepage-cms">
      <div className="section-toolbar">
        <div>
          <h2>Homepage CMS</h2>
          <p>Manage your customer storefront hero and promotional banners.</p>
        </div>
        <div className="cms-toolbar-actions">
          <button className="secondary-button" onClick={() => void loadBanners()}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="primary-button" onClick={openCreate}>
            <Plus size={18} /> Create banner
          </button>
        </div>
      </div>

      <div className="cms-stats">
        <div className="cms-stat">
          <span>Total banners</span>
          <strong>{banners.length}</strong>
        </div>
        <div className="cms-stat">
          <span>Published</span>
          <strong>{banners.filter((b) => b.isPublished).length}</strong>
        </div>
        <div className="cms-stat">
          <span>Active</span>
          <strong>{banners.filter((b) => b.isActive).length}</strong>
        </div>
        <div className="cms-stat">
          <span>Drafts</span>
          <strong>{banners.filter((b) => !b.isPublished).length}</strong>
        </div>
      </div>

      {error && <div className="cms-alert cms-alert-error">{error}</div>}
      {success && <div className="cms-alert cms-alert-success">{success}</div>}

      {formOpen && (
        <div className="cms-editor panel">
          <div className="cms-editor-heading">
            <div>
              <h3>{editing ? 'Edit banner' : 'Create homepage banner'}</h3>
              <p>Changes are saved to the store database.</p>
            </div>
            <button
              className="cms-icon-button"
              type="button"
              onClick={() => setFormOpen(false)}
              aria-label="Close editor"
            >
              <X size={19} />
            </button>
          </div>

          <form onSubmit={saveBanner}>
            <div className="cms-form-grid">
              <div className="form-field">
                <label htmlFor="cms-title">Banner heading *</label>
                <input
                  id="cms-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  maxLength={160}
                  required
                  placeholder="Everything you need, right at your doorstep"
                />
              </div>

              <div className="form-field">
                <label htmlFor="cms-type">Banner placement *</label>
                <select
                  id="cms-type"
                  value={form.bannerType}
                  onChange={(e) =>
                    setForm({ ...form, bannerType: e.target.value as 'hero' | 'promo' })
                  }
                >
                  <option value="hero">Main Hero Banner</option>
                  <option value="promo">Promotional Banner</option>
                </select>
              </div>

              <div className="form-field cms-full">
                <label htmlFor="cms-subtitle">Description / Subtitle</label>
                <textarea
                  id="cms-subtitle"
                  rows={3}
                  maxLength={500}
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  placeholder="Write a short description for customers..."
                />
              </div>

              <div className="form-field cms-full">
                <label htmlFor="cms-image">Banner image URL</label>
                <input
                  id="cms-image"
                  type="url"
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="https://example.com/banner.webp"
                />
                <div className="form-field cms-full">
  <label htmlFor="cms-image-upload">
    Upload image from computer
  </label>

  <input
    id="cms-image-upload"
    type="file"
    accept="image/jpeg,image/png,image/webp,image/gif"
    disabled={uploadingImage}
    onChange={(e) => {
      const file = e.target.files?.[0];
      if (file) void handleBannerImageUpload(file);
      e.currentTarget.value = '';
    }}
  />

  <small>
    JPG, PNG, WEBP or GIF. Maximum file size: 5 MB.
  </small>

  {uploadingImage && <p>Uploading image...</p>}
</div>
              </div>

              {form.imageUrl && (
                <div className="cms-live-preview cms-full">
  <div className="cms-live-preview-header">
    <div>
      <span className="cms-live-preview-kicker">LIVE PREVIEW</span>
      <strong>
        {form.bannerType === 'hero' ? 'Hero Banner' : 'Promo Banner'}
      </strong>
    </div>

    <span
      className={
        form.isPublished
          ? 'cms-preview-status cms-preview-published'
          : 'cms-preview-status cms-preview-draft'
      }
    >
      {form.isPublished ? 'Published' : 'Draft'}
    </span>
  </div>

  {form.bannerType === 'promo' ? (
    <section className="cms-storefront-promo-preview">
      <div className="cms-storefront-promo-content">
        <span className="cms-storefront-promo-label">
          DISCOVER SOMETHING NEW
        </span>

        <h3>
          {form.title.trim() || 'More choices. More convenience.'}
        </h3>

        <p>
          {form.subtitle.trim() ||
            'Explore grocery, electronics, solar and everyday essentials.'}
        </p>

        <button type="button">
          {form.ctaText.trim() || 'Start shopping'}
        </button>
      </div>

      <div className="cms-storefront-promo-art">
        {form.imageUrl ? (
          <img
            src={form.imageUrl}
            alt={form.title || 'Promo banner preview'}
          />
        ) : (
          <>
            <div className="cms-preview-art-circle" />
            <span>🛍️</span>
            <span>🍎</span>
            <span>📱</span>
            <span>☀️</span>
          </>
        )}
      </div>
    </section>
  ) : (
    <section
  className="cms-storefront-hero-preview cms-storefront-hero-background"
  style={
    form.imageUrl
      ? {
          backgroundImage: `url("${form.imageUrl}")`,
        }
      : undefined
  }
>
  <div className="cms-storefront-hero-overlay" />

  <div className="cms-storefront-hero-content">
    <span className="cms-storefront-hero-eyebrow">
      ⚡ ONE STORE. ENDLESS POSSIBILITIES.
    </span>

    <h3>
      {form.title.trim() || 'Everything you need.'}
    </h3>

    <p>
      {form.subtitle.trim() ||
        'From daily essentials to electronics and solar solutions, discover more with Riya Quick Commerce.'}
    </p>

    <div className="cms-storefront-hero-actions">
      <button type="button">
        {form.ctaText.trim() || 'Explore products'} →
      </button>

      <span>🛡️ Trusted shopping</span>
    </div>

    <div className="cms-storefront-hero-stats">
      <span>
        <strong>All-in-one</strong>
        <small>Shopping destination</small>
      </span>

      <span>
        <strong>Local</strong>
        <small>Delivery network</small>
      </span>

      <span>
        <strong>Easy</strong>
        <small>Online shopping</small>
      </span>
    </div>
  </div>
</section>
  )}
</div>
              )}

              <div className="form-field">
                <label htmlFor="cms-cta-text">Button text</label>
                <input
                  id="cms-cta-text"
                  value={form.ctaText}
                  onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
                  maxLength={80}
                />
              </div>

              <div className="form-field">
                <label htmlFor="cms-cta-link">Button link</label>
                <input
                  id="cms-cta-link"
                  value={form.ctaLink}
                  onChange={(e) => setForm({ ...form, ctaLink: e.target.value })}
                  maxLength={500}
                  placeholder="#products"
                />
              </div>

              <div className="form-field">
                <label htmlFor="cms-order">Display order</label>
                <input
                  id="cms-order"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                />
              </div>
            </div>

            <div className="cms-switches">
              <label>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Active
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                />
                Published
              </label>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={saving}>
                <Save size={16} />
                {saving ? 'Saving...' : editing ? 'Update banner' : 'Save banner'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="cms-filter-bar">
        <div>
          <Monitor size={18} />
          <strong>Storefront banners</strong>
        </div>
        <div className="cms-filter-buttons">
          {(['all', 'hero', 'promo'] as const).map((value) => (
            <button
              key={value}
              className={filter === value ? 'selected' : ''}
              onClick={() => setFilter(value)}
            >
              {value === 'all' ? 'All banners' : value === 'hero' ? 'Hero' : 'Promotions'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="panel cms-empty">Loading homepage banners...</div>
      ) : visibleBanners.length === 0 ? (
        <div className="panel cms-empty">
          <ImageIcon size={34} />
          <h3>No banners found</h3>
          <p>Create your first hero or promotional banner.</p>
          <button className="primary-button" onClick={openCreate}>
            <Plus size={17} /> Create banner
          </button>
        </div>
      ) : (
        <div className="cms-banner-grid">
          {visibleBanners.map((banner) => (
            <article className={`cms-banner-card ${
    draggedBannerId === banner.id ? 'cms-banner-card-dragging' : ''
  }`}
  key={banner.id}
  draggable={!reordering}
  onDragStart={() => setDraggedBannerId(banner.id)}
  onDragOver={(event) => event.preventDefault()}
  onDrop={() => handleBannerDrop(banner.id)}
  onDragEnd={() => setDraggedBannerId(null)}
>
  <div
  className="cms-drag-handle"
  title="Drag to change banner order"
  aria-label="Drag to change banner order"
>
  ⋮⋮
</div>
              <div className="cms-banner-image">
                {banner.imageUrl ? (
                  <img src={banner.imageUrl} alt={banner.title} />
                ) : (
                  <div className="cms-no-image"><ImageIcon size={30} /> No image</div>
                )}
                <span className={`cms-placement cms-${banner.bannerType}`}>
                  {banner.bannerType === 'hero' ? 'HERO' : 'PROMO'}
                </span>
              </div>

              <div className="cms-banner-content">
                <div className="cms-banner-status">
                  <span className={banner.isPublished ? 'cms-published' : 'cms-draft'}>
                    {banner.isPublished ? 'Published' : 'Draft'}
                  </span>
                  <span className={banner.isActive ? 'cms-active' : 'cms-inactive'}>
                    {banner.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <h3>{banner.title}</h3>
                <p>{banner.subtitle || 'No description added.'}</p>

                <div className="cms-banner-meta">
                  <span>Order: {banner.sortOrder}</span>
                  <span>ID: {banner.id}</span>
                </div>

                <div className="cms-banner-actions">
                  <button className="secondary-button" onClick={() => openEdit(banner)}>
                    <Pencil size={15} /> Edit
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => void toggleBanner(banner, 'isPublished')}
                    title="Toggle publication"
                  >
                    {banner.isPublished ? <EyeOff size={15} /> : <Globe size={15} />}
                    {banner.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => void toggleBanner(banner, 'isActive')}
                    title="Toggle active status"
                  >
                    {banner.isActive ? <EyeOff size={15} /> : <Eye size={15} />}
                    {banner.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    className="cms-delete-button"
                    onClick={() => void deleteBanner(banner)}
                    title="Delete banner"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

