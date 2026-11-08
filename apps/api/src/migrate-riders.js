import db from "./database.js";

const migrate = db.transaction(() => {
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
  `);

  const columns = db.prepare("PRAGMA table_info(orders)").all();
  const hasRiderColumn = columns.some(
    (column) => column.name === "assigned_rider_id"
  );

  if (!hasRiderColumn) {
    db.exec(`
      ALTER TABLE orders
      ADD COLUMN assigned_rider_id INTEGER
      REFERENCES riders(id) ON DELETE SET NULL;
    `);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_orders_assigned_rider
    ON orders(assigned_rider_id);

    CREATE INDEX IF NOT EXISTS idx_riders_active
    ON riders(is_active);
  `);
});

try {
  migrate();

  console.log("Rider migration completed successfully.");
  console.log("\nRiders table:");
  console.table(
    db.prepare("PRAGMA table_info(riders)").all()
  );

  console.log("\nOrders rider column:");
  console.table(
    db.prepare("PRAGMA table_info(orders)")
      .all()
      .filter((column) => column.name === "assigned_rider_id")
  );
} catch (error) {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
} finally {
  db.close();
}


