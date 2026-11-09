import { runHomepageCmsMigration } from "./migrations/homepage-cms.js";
import { runCustomerProfileMigration } from "./migrations/customer-profile.js";
import { runCustomerAdminSecurityMigration } from "./migrations/customer-admin-security.js";
import { runCustomerEmailVerificationMigration } from "./migrations/customer-email-verification.js";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import {
  runCommerceFoundationMigration
} from "./migrations/commerce-foundation.js";


dotenv.config();

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(currentDir, "..");

const databaseFile = path.resolve(
  apiRoot,
  process.env.DATABASE_FILE || "./data/riya-commerce.db"
);

fs.mkdirSync(path.dirname(databaseFile), { recursive: true });

const db = new Database(databaseFile);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Existing tables: preserved
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    category_id INTEGER,
    price REAL NOT NULL CHECK(price >= 0),
    original_price REAL CHECK(original_price IS NULL OR original_price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
    image_url TEXT DEFAULT '',
    sku TEXT UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS inventory_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    change_amount INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    reason TEXT DEFAULT 'Manual update',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE INDEX IF NOT EXISTS idx_products_category
  ON products(category_id);

  CREATE INDEX IF NOT EXISTS idx_products_active
  ON products(is_active);

  -- New admin table
  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Admin activity history
  CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(admin_id) REFERENCES admin_users(id)
  );
`);

// ---------------- ORDERS MANAGEMENT TABLES ----------------
// Safe migration: CREATE TABLE IF NOT EXISTS preserves existing data.

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_email TEXT DEFAULT '',
    customer_phone TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    delivery_city TEXT DEFAULT '',
    delivery_state TEXT DEFAULT '',
    delivery_pincode TEXT DEFAULT '',
    subtotal REAL NOT NULL DEFAULT 0 CHECK(subtotal >= 0),
    delivery_fee REAL NOT NULL DEFAULT 0 CHECK(delivery_fee >= 0),
    discount REAL NOT NULL DEFAULT 0 CHECK(discount >= 0),
    total_amount REAL NOT NULL DEFAULT 0 CHECK(total_amount >= 0),
    payment_method TEXT NOT NULL DEFAULT 'COD',
    payment_status TEXT NOT NULL DEFAULT 'pending',
    status TEXT NOT NULL DEFAULT 'Placed',
    customer_notes TEXT DEFAULT '',
    cancellation_reason TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    sku TEXT DEFAULT '',
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price REAL NOT NULL CHECK(unit_price >= 0),
    line_total REAL NOT NULL CHECK(line_total >= 0),
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS order_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    old_status TEXT DEFAULT '',
    new_status TEXT NOT NULL,
    note TEXT DEFAULT '',
    changed_by INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY(changed_by) REFERENCES admin_users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_orders_status
  ON orders(status);

  CREATE INDEX IF NOT EXISTS idx_orders_created
  ON orders(created_at);

  CREATE INDEX IF NOT EXISTS idx_orders_phone
  ON orders(customer_phone);

  CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON order_items(order_id);

  CREATE INDEX IF NOT EXISTS idx_order_events_order
  ON order_events(order_id);
`);



// ---------------- PRODUCT DETAILS TABLES ----------------
// Additive migration: existing products, orders and inventory are preserved.

db.exec(`
  CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    alt_text TEXT DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_primary INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_product_images_product
  ON product_images(product_id, sort_order);

  CREATE TABLE IF NOT EXISTS product_specifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    specification_name TEXT NOT NULL,
    specification_value TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_product_specs_product
  ON product_specifications(product_id, sort_order);

  CREATE TABLE IF NOT EXISTS product_recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    recommended_product_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, recommended_product_id),
    CHECK(product_id <> recommended_product_id),
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY(recommended_product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_product_recommendations_product
  ON product_recommendations(product_id, sort_order);

  CREATE TABLE IF NOT EXISTS product_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT DEFAULT '',
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    review_title TEXT DEFAULT '',
    review_text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending', 'approved', 'rejected')),
    admin_reply TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_product_reviews_product_status
  ON product_reviews(product_id, status);

  CREATE INDEX IF NOT EXISTS idx_product_reviews_created
  ON product_reviews(created_at);
`);

// Existing sample data: INSERT OR IGNORE prevents overwriting existing records
const seed = db.transaction(() => {
  const categories = [
    ["Grocery", "grocery"],
    ["Electronics", "electronics"],
    ["Solar", "solar"],
    ["Home & Living", "home-living"],
    ["Personal Care", "personal-care"],
    ["Electrical", "electrical"]
  ];

  const insertCategory = db.prepare(`
    INSERT OR IGNORE INTO categories (name, slug)
    VALUES (?, ?)
  `);

  for (const category of categories) {
    insertCategory.run(...category);
  }

  const categoryRows = db.prepare(
    "SELECT id, slug FROM categories"
  ).all();

  const categoryMap = Object.fromEntries(
    categoryRows.map((item) => [item.slug, item.id])
  );

  const sampleProducts = [
    {
      name: "Fresh Grocery Combo",
      slug: "fresh-grocery-combo",
      description: "Daily grocery essentials for your home.",
      category: "grocery",
      price: 299,
      originalPrice: 349,
      stock: 50,
      sku: "RIYA-GRO-001"
    },
    {
      name: "Smart LED Bulb",
      slug: "smart-led-bulb",
      description: "Energy-efficient LED bulb for everyday use.",
      category: "electrical",
      price: 149,
      originalPrice: 199,
      stock: 40,
      sku: "RIYA-ELE-001"
    },
    {
      name: "Solar LED Light",
      slug: "solar-led-light",
      description: "Solar-powered outdoor lighting solution.",
      category: "solar",
      price: 899,
      originalPrice: 1099,
      stock: 20,
      sku: "RIYA-SOL-001"
    },
    {
      name: "Wireless Earbuds",
      slug: "wireless-earbuds",
      description: "Wireless earbuds for music and calls.",
      category: "electronics",
      price: 799,
      originalPrice: 999,
      stock: 15,
      sku: "RIYA-ELC-001"
    },
    {
      name: "Home Storage Organizer",
      slug: "home-storage-organizer",
      description: "Useful organizer for home storage.",
      category: "home-living",
      price: 399,
      originalPrice: 499,
      stock: 25,
      sku: "RIYA-HOM-001"
    },
    {
      name: "Personal Care Kit",
      slug: "personal-care-kit",
      description: "Everyday personal care essentials.",
      category: "personal-care",
      price: 249,
      originalPrice: 299,
      stock: 30,
      sku: "RIYA-PER-001"
    }
  ];

  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products
    (name, slug, description, category_id, price,
     original_price, stock, sku)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const product of sampleProducts) {
    insertProduct.run(
      product.name,
      product.slug,
      product.description,
      categoryMap[product.category],
      product.price,
      product.originalPrice,
      product.stock,
      product.sku
    );
  }
});

seed();

// ============================================================
// RIYA QUICK COMMERCE - RIDERS FOUNDATION MIGRATION
// Additive migration: existing rider data and orders are preserved.
// ============================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS riders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_riders_active
    ON riders(is_active);
`);

const ordersColumnsForRider = db.prepare("PRAGMA table_info(orders)").all();

const hasAssignedRiderColumn = ordersColumnsForRider.some(
  (column) => column.name === "assigned_rider_id"
);

if (!hasAssignedRiderColumn) {
  db.exec(`
    ALTER TABLE orders
    ADD COLUMN assigned_rider_id INTEGER
    REFERENCES riders(id) ON DELETE SET NULL;
  `);
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_orders_assigned_rider
    ON orders(assigned_rider_id);
`);
// ============================================================
// RIYA QUICK COMMERCE - GPS FOUNDATION MIGRATION
// Additive migration: existing data and tables are preserved.
// ============================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS rider_presence (
    rider_id INTEGER PRIMARY KEY,
    is_online INTEGER NOT NULL DEFAULT 0
      CHECK(is_online IN (0, 1)),
    last_seen_at TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(rider_id) REFERENCES riders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS rider_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rider_id INTEGER NOT NULL,
    latitude REAL NOT NULL
      CHECK(latitude BETWEEN -90 AND 90),
    longitude REAL NOT NULL
      CHECK(longitude BETWEEN -180 AND 180),
    accuracy REAL,
    heading REAL,
    speed REAL,
    recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(rider_id) REFERENCES riders(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_rider_locations_latest
    ON rider_locations(rider_id, id DESC);

  CREATE INDEX IF NOT EXISTS idx_rider_presence_online
    ON rider_presence(is_online, last_seen_at);

  CREATE TABLE IF NOT EXISTS delivery_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL UNIQUE,
    rider_id INTEGER NOT NULL,
    tracking_enabled INTEGER NOT NULL DEFAULT 1
      CHECK(tracking_enabled IN (0, 1)),
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TEXT,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY(rider_id) REFERENCES riders(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_delivery_tracking_rider
    ON delivery_tracking(rider_id, tracking_enabled);
`);

// Initialize presence records for existing active riders.
// Existing rider accounts are not modified.
db.prepare(`
  INSERT OR IGNORE INTO rider_presence (rider_id, is_online)
  SELECT id, 0
  FROM riders
`).run();

console.log("[GPS] Additive GPS schema migration checked.");

// Commerce Foundation - additive migration
runCommerceFoundationMigration(db);
runCustomerProfileMigration(db);
runHomepageCmsMigration(db);
runCustomerAdminSecurityMigration(db);
runCustomerEmailVerificationMigration(db);

export default db;

