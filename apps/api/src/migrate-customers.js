import db from "./database.js";

// Customer accounts
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    phone TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add customer_id to existing orders only if it is missing.
const orderColumns = db.pragma("table_info(orders)");
const hasCustomerId = orderColumns.some(
  (column) => column.name === "customer_id"
);

if (!hasCustomerId) {
  db.exec(`
    ALTER TABLE orders
    ADD COLUMN customer_id INTEGER REFERENCES customers(id);
  `);
  console.log("Added orders.customer_id");
} else {
  console.log("orders.customer_id already exists");
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_orders_customer
  ON orders(customer_id);

  CREATE INDEX IF NOT EXISTS idx_customers_active
  ON customers(is_active);
`);

console.log("Customer database migration completed.");
console.log(
  "Customers table:",
  db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'customers'").get()
);
console.log(
  "Orders customer_id:",
  db.pragma("table_info(orders)").some((column) => column.name === "customer_id")
);

