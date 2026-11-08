import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import db from "../database.js";

dotenv.config();

const email = String(process.env.ADMIN_EMAIL || "")
  .trim()
  .toLowerCase();

const password = String(process.env.ADMIN_PASSWORD || "");

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Set a valid ADMIN_EMAIL in apps/api/.env");
  process.exit(1);
}

if (password.length < 12 || password.length > 200) {
  console.error("ADMIN_PASSWORD must be 12-200 characters.");
  process.exit(1);
}

const existing = db.prepare(`
  SELECT id FROM admin_users WHERE email = ?
`).get(email);

const hash = bcrypt.hashSync(password, 12);

if (existing) {
  db.prepare(`
    UPDATE admin_users
    SET
      password_hash = ?,
      is_active = 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(hash, existing.id);

  console.log(`Admin password updated for ${email}`);

} else {
  db.prepare(`
    INSERT INTO admin_users (email, password_hash)
    VALUES (?, ?)
  `).run(email, hash);

  console.log(`Admin account created for ${email}`);
}

console.log("Admin setup completed.");
console.log("Keep your .env private.");