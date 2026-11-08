
/**
 * RIYA QUICK COMMERCE
 * Additive Commerce Foundation Migration
 *
 * Existing products, orders, customers and riders are preserved.
 */

export function runCommerceFoundationMigration(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      address TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT 'Uttar Pradesh',
      pincode TEXT NOT NULL DEFAULT '',
      latitude REAL,
      longitude REAL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS warehouse_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      reserved_quantity INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      UNIQUE(warehouse_id, product_id),

      FOREIGN KEY(warehouse_id)
        REFERENCES warehouses(id),

      FOREIGN KEY(product_id)
        REFERENCES products(id),

      CHECK(quantity >= 0),
      CHECK(reserved_quantity >= 0)
    );

    CREATE INDEX IF NOT EXISTS
      idx_warehouse_inventory_product
      ON warehouse_inventory(product_id, warehouse_id);

    CREATE TABLE IF NOT EXISTS service_areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      pincode TEXT NOT NULL,
      radius_km REAL NOT NULL DEFAULT 5,
      latitude REAL,
      longitude REAL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY(warehouse_id)
        REFERENCES warehouses(id),

      CHECK(radius_km > 0 AND radius_km <= 100)
    );

    CREATE INDEX IF NOT EXISTS
      idx_service_areas_pincode
      ON service_areas(pincode, is_active);

    CREATE TABLE IF NOT EXISTS payment_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      provider_order_id TEXT,
      provider_payment_id TEXT,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL DEFAULT 'created',
      provider_payload TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY(order_id)
        REFERENCES orders(id),

      CHECK(amount >= 0),

      CHECK(status IN (
        'created',
        'pending',
        'paid',
        'failed',
        'refunded'
      ))
    );

    CREATE INDEX IF NOT EXISTS
      idx_payment_attempts_order
      ON payment_attempts(order_id, id DESC);

    CREATE TABLE IF NOT EXISTS external_delivery_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      external_job_id TEXT,
      status TEXT NOT NULL DEFAULT 'not_requested',
      request_payload TEXT DEFAULT '',
      response_payload TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY(order_id)
        REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS notification_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel TEXT NOT NULL,
      recipient TEXT NOT NULL,
      template_key TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'queued',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CHECK(status IN (
        'queued',
        'processing',
        'sent',
        'failed'
      ))
    );

    CREATE INDEX IF NOT EXISTS
      idx_notification_outbox_status
      ON notification_outbox(status, id);
  `);

  // Seed one default warehouse only when none exists.
  const existingWarehouse = db
    .prepare("SELECT id FROM warehouses LIMIT 1")
    .get();

  if (!existingWarehouse) {
    db.prepare(`
      INSERT INTO warehouses (
        name,
        code,
        address,
        city,
        state
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(
      process.env.DEFAULT_WAREHOUSE_NAME || "Riya Main Warehouse",
      process.env.DEFAULT_WAREHOUSE_CODE || "RIYA-MAIN",
      process.env.DEFAULT_WAREHOUSE_ADDRESS || "",
      process.env.DEFAULT_WAREHOUSE_CITY || "Kannauj",
      process.env.DEFAULT_WAREHOUSE_STATE || "Uttar Pradesh"
    );
  }

  console.log(
    "[RIYA COMMERCE] Foundation migration completed."
  );
}
