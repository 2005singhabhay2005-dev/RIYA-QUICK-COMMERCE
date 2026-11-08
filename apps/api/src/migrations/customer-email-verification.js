export function runCustomerEmailVerificationMigration(db) {
  const columns = db.prepare(`
    PRAGMA table_info(customers)
  `).all();

  const hasEmailVerified = columns.some(
    column => column.name === "email_verified"
  );

  if (!hasEmailVerified) {
    db.prepare(`
      ALTER TABLE customers
      ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1
    `).run();

    console.log(
      "[CUSTOMER EMAIL VERIFICATION] Added customers.email_verified."
    );
  } else {
    console.log(
      "[CUSTOMER EMAIL VERIFICATION] customers.email_verified already exists."
    );
  }

  const otpColumns = db.prepare(`
    PRAGMA table_info(customer_email_otps)
  `).all();

  if (otpColumns.length === 0) {
    db.prepare(`
      CREATE TABLE customer_email_otps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        otp_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        verified_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      )
    `).run();

    db.prepare(`
      CREATE INDEX idx_customer_email_otps_customer_id
      ON customer_email_otps(customer_id)
    `).run();

    console.log(
      "[CUSTOMER EMAIL VERIFICATION] Created customer_email_otps table."
    );
  } else {
    console.log(
      "[CUSTOMER EMAIL VERIFICATION] customer_email_otps already exists."
    );
  }
}
