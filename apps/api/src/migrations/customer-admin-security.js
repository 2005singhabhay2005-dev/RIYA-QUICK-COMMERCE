export function runCustomerAdminSecurityMigration(db) {
  const columns = db.prepare(`
    PRAGMA table_info(customers)
  `).all();

  const hasSessionVersion = columns.some(
    column => column.name === "session_version"
  );

  if (!hasSessionVersion) {
    db.prepare(`
      ALTER TABLE customers
      ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1
    `).run();

    console.log(
      "[CUSTOMER ADMIN SECURITY] Added customers.session_version."
    );
  } else {
    console.log(
      "[CUSTOMER ADMIN SECURITY] customers.session_version already exists."
    );
  }
}
