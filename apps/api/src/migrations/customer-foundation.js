/**
 * RIYA QUICK COMMERCE
 * Customer Foundation Migration
 *
 * Additive migration: existing customer data is preserved.
 * Creates the customers table only when it does not already exist.
 */

export function runCustomerFoundationMigration(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      session_version INTEGER NOT NULL DEFAULT 1,
      email_verified INTEGER NOT NULL DEFAULT 1
        CHECK(email_verified IN (0, 1))
    );

    CREATE INDEX IF NOT EXISTS idx_customers_active
      ON customers(is_active);
  `);

  console.log("[CUSTOMER FOUNDATION] Customer schema checked.");
}
