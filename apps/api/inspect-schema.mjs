import db from "./src/database.js";

const tables = db.prepare(`
  SELECT name, sql
  FROM sqlite_master
  WHERE type = 'table'
  ORDER BY name
`).all();

for (const table of tables) {
  console.log("\nTABLE:", table.name);
  console.log(table.sql);
}

db.close();
