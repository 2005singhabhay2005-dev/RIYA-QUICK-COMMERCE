export function runCustomerProfileMigration(db) {
  db.exec(`
    -- ============================================================
    -- CUSTOMER PROFILE
    -- Additive migration: existing customer data is preserved.
    -- ============================================================

    CREATE TABLE IF NOT EXISTS customer_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL UNIQUE,
      date_of_birth TEXT DEFAULT '',
      gender TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      language TEXT NOT NULL DEFAULT 'hi',
      currency TEXT NOT NULL DEFAULT 'INR',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id)
        REFERENCES customers(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_customer_profiles_customer
      ON customer_profiles(customer_id);

    -- ============================================================
    -- SAVED CUSTOMER ADDRESSES
    -- Existing order delivery addresses remain unchanged.
    -- ============================================================

    CREATE TABLE IF NOT EXISTS customer_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      label TEXT NOT NULL DEFAULT 'Home',
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address_line1 TEXT NOT NULL,
      address_line2 TEXT DEFAULT '',
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      pincode TEXT NOT NULL,
      landmark TEXT DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0
        CHECK(is_default IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id)
        REFERENCES customers(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer
      ON customer_addresses(customer_id);

    CREATE INDEX IF NOT EXISTS idx_customer_addresses_default
      ON customer_addresses(customer_id, is_default);
  `);

  // Create a profile row for every existing customer.
  // Existing customer records are never overwritten.
  db.prepare(`
    INSERT OR IGNORE INTO customer_profiles
      (customer_id)
    SELECT id
    FROM customers
  `).run();

  console.log("[CUSTOMER PROFILE] Additive profile/address schema migration checked.");
}

