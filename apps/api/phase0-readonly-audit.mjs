import Database from "better-sqlite3";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

const databaseFile = path.resolve(
  process.cwd(),
  process.env.DATABASE_FILE || "./data/riya-commerce.db"
);

const db = new Database(databaseFile, {
  readonly: true,
  fileMustExist: true
});

try {
  console.log("\n========== DATABASE INTEGRITY ==========");
  console.table(db.pragma("integrity_check"));

  console.log("\n========== FOREIGN KEY CHECK ==========");
  console.table(db.pragma("foreign_key_check"));

  const tables = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  console.log("\n========== EXISTING TABLES & ROW COUNTS ==========");

  for (const { name } of tables) {
    const safeName = name.replaceAll('"', '""');
    const count = db.prepare(`SELECT COUNT(*) AS total FROM "${safeName}"`).get();
    console.log(`${name}: ${count.total}`);
  }

  console.log("\n========== TABLE COLUMNS ==========");

  for (const { name } of tables) {
    const safeName = name.replaceAll('"', '""');
    console.log(`\n--- ${name} ---`);
    console.table(
      db.pragma(`table_info("${safeName}")`).map(column => ({
        column: column.name,
        type: column.type,
        notNull: column.notnull,
        primaryKey: column.pk
      }))
    );
  }

  console.log("\n========== ORDER STATUS SUMMARY ==========");
  if (tables.some(t => t.name === "orders")) {
    console.table(
      db.prepare(`
        SELECT status, payment_method, payment_status, COUNT(*) AS total
        FROM orders
        GROUP BY status, payment_method, payment_status
        ORDER BY status
      `).all()
    );
  }

  console.log("\n========== PRODUCT SUMMARY ==========");
  if (tables.some(t => t.name === "products")) {
    console.table(
      db.prepare(`
        SELECT
          COUNT(*) AS total_products,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_products,
          SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) AS out_of_stock
        FROM products
      `).get()
    );
  }
} finally {
  db.close();
}
