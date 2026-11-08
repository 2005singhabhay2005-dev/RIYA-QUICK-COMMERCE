export function runHomepageCmsMigration(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS homepage_banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      banner_type TEXT NOT NULL DEFAULT 'hero'
        CHECK (banner_type IN ('hero', 'promo')),
      cta_text TEXT NOT NULL DEFAULT 'Explore now',
      cta_link TEXT NOT NULL DEFAULT '#products',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),
      is_published INTEGER NOT NULL DEFAULT 0
        CHECK (is_published IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_homepage_banners_public
      ON homepage_banners(is_published, is_active, banner_type, sort_order);
  `);
}
