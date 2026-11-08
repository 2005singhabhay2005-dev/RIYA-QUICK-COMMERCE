import Database from "better-sqlite3";

const db = new Database("./data/riya-commerce.db", {
  readonly: true
});

try {
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = ? ORDER BY name"
  ).all("table");

  console.log("\n===== DATABASE TABLES =====");
  for (const table of tables) {
    console.log("- " + table.name);
  }

  console.log("\n===== DATABASE INTEGRITY =====");
  console.log(db.pragma("integrity_check"));

  console.log("\n===== FOREIGN KEY CHECK =====");
  console.log(db.pragma("foreign_key_check"));
} finally {
  db.close();
}
