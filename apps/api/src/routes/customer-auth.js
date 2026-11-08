import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";

import db from "../database.js";
import { requireCustomer } from "../middleware/customer-auth.js";
import { sendCustomerEmailOtp } from "../services/email.js";

const router = Router();

function validatePassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    Buffer.byteLength(password, "utf8") <= 72
  );
}

function generateEmailOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashEmailOtp(otp) {
  return crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");
}

function createOtpExpiry() {
  return new Date(Date.now() + 10 * 60 * 1000).toISOString();
}

function isOtpExpired(expiresAt) {
  return Date.now() >= new Date(expiresAt).getTime();
}

function createToken(customerId, sessionVersion = 1) {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
  }

  return jwt.sign(
    {
      role: "customer",
      sessionVersion
    },
    secret,
    {
      subject: String(customerId),
      issuer: "riya-quick-commerce",
      expiresIn: "7d",
      algorithm: "HS256"
    }
  );
}

function publicCustomer(customer) {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone
  };
}

// CUSTOMER REGISTRATION
router.post("/register", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const phone = String(req.body?.phone || "").trim();
    const password = String(req.body?.password || "");

    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Name must contain 2 to 100 characters"
      });
    }

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address"
      });
    }

    if (!/^\+?[0-9\s-]{10,18}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid phone number"
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters and at most 72 bytes"
      });
    }

    const passwordHash = bcrypt.hashSync(password, 12);

    const insertCustomer = db.prepare(`
      INSERT INTO customers (
        name,
        email,
        phone,
        password_hash,
        is_active,
        email_verified
      )
      VALUES (?, ?, ?, ?, 0, 0)
    `);

    const customer = db.transaction(() => {
      const result = insertCustomer.run(
        name,
        email,
        phone,
        passwordHash
      );

      return db.prepare(`
        SELECT
          id,
          name,
          email,
          phone,
          session_version
        FROM customers
        WHERE id = ?
      `).get(result.lastInsertRowid);
    })();

    const otp = generateEmailOtp();
    const otpHash = hashEmailOtp(otp);
    const expiresAt = createOtpExpiry();

    db.prepare(`
      DELETE FROM customer_email_otps
      WHERE customer_id = ?
    `).run(customer.id);

    db.prepare(`
      INSERT INTO customer_email_otps (
        customer_id,
        email,
        otp_hash,
        expires_at,
        attempts,
        last_sent_at
      )
      VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `).run(
      customer.id,
      email,
      otpHash,
      expiresAt
    );

    try {
      await sendCustomerEmailOtp({
        to: email,
        customerName: name,
        otp
      });
    } catch (emailError) {
      db.prepare(`
        DELETE FROM customer_email_otps
        WHERE customer_id = ?
      `).run(customer.id);

      db.prepare(`
        DELETE FROM customers
        WHERE id = ? AND email_verified = 0 AND is_active = 0
      `).run(customer.id);

      console.error(
        "Customer registration email error:",
        emailError.message
      );

      return res.status(503).json({
        success: false,
        message: "Unable to send verification email. Please try again."
      });
    }

    return res.status(201).json({
      success: true,
      message: "Verification OTP sent to your email",
      data: {
        requiresEmailVerification: true,
        customerId: customer.id,
        email: customer.email
      }
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists"
      });
    }

    console.error("Customer registration error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create customer account"
    });
  }
});

// VERIFY CUSTOMER REGISTRATION OTP
router.post("/register/verify-otp", (req, res) => {
  try {
    const customerId = Number(req.body?.customerId);
    const otp = String(req.body?.otp || "").trim();

    if (
      !Number.isSafeInteger(customerId) ||
      customerId < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer verification request"
      });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "Enter the 6-digit OTP"
      });
    }

    const customer = db.prepare(`
      SELECT
        id,
        name,
        email,
        phone,
        is_active,
        email_verified,
        session_version
      FROM customers
      WHERE id = ?
    `).get(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer account not found"
      });
    }

    if (Number(customer.email_verified) === 1) {
      const token = createToken(
        customer.id,
        customer.session_version
      );

      return res.json({
        success: true,
        message: "Email already verified",
        data: {
          token,
          customer: publicCustomer(customer)
        }
      });
    }

    const verification = db.prepare(`
      SELECT
        id,
        otp_hash,
        expires_at,
        attempts,
        verified_at
      FROM customer_email_otps
      WHERE customer_id = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(customer.id);

    if (!verification || verification.verified_at) {
      return res.status(400).json({
        success: false,
        message: "Verification OTP is not available. Please request a new OTP."
      });
    }

    if (Number(verification.attempts) >= 5) {
      return res.status(429).json({
        success: false,
        message: "Too many incorrect OTP attempts. Please request a new OTP."
      });
    }

    if (isOtpExpired(verification.expires_at)) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new OTP."
      });
    }

    const expectedHash = hashEmailOtp(otp);

    if (expectedHash !== verification.otp_hash) {
      db.prepare(`
        UPDATE customer_email_otps
        SET attempts = attempts + 1
        WHERE id = ?
      `).run(verification.id);

      return res.status(400).json({
        success: false,
        message: "Invalid OTP"
      });
    }

    db.transaction(() => {
      db.prepare(`
        UPDATE customer_email_otps
        SET verified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(verification.id);

      db.prepare(`
        UPDATE customers
        SET email_verified = 1,
            is_active = 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(customer.id);
    })();

    const updatedCustomer = db.prepare(`
      SELECT
        id,
        name,
        email,
        phone,
        session_version
      FROM customers
      WHERE id = ?
    `).get(customer.id);

    const token = createToken(
      updatedCustomer.id,
      updatedCustomer.session_version
    );

    return res.json({
      success: true,
      message: "Email verified and account activated successfully",
      data: {
        token,
        customer: publicCustomer(updatedCustomer)
      }
    });
  } catch (error) {
    console.error(
      "Customer email OTP verification error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Unable to verify email"
    });
  }
});

// RESEND CUSTOMER REGISTRATION OTP
router.post("/register/resend-otp", async (req, res) => {
  try {
    const customerId = Number(req.body?.customerId);

    if (
      !Number.isSafeInteger(customerId) ||
      customerId < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer verification request"
      });
    }

    const customer = db.prepare(`
      SELECT
        id,
        name,
        email,
        is_active,
        email_verified
      FROM customers
      WHERE id = ?
    `).get(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer account not found"
      });
    }

    if (Number(customer.email_verified) === 1) {
      return res.status(400).json({
        success: false,
        message: "Customer email is already verified"
      });
    }

    const previousOtp = db.prepare(`
      SELECT last_sent_at
      FROM customer_email_otps
      WHERE customer_id = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(customer.id);

    if (previousOtp?.last_sent_at) {
      const secondsSinceLastSend =
        (Date.now() - new Date(previousOtp.last_sent_at + "Z").getTime()) /
        1000;

      if (
        Number.isFinite(secondsSinceLastSend) &&
        secondsSinceLastSend < 60
      ) {
        const waitSeconds = Math.ceil(
          60 - secondsSinceLastSend
        );

        return res.status(429).json({
          success: false,
          message: `Please wait ${waitSeconds} seconds before requesting another OTP`
        });
      }
    }

    const otp = generateEmailOtp();
    const otpHash = hashEmailOtp(otp);
    const expiresAt = createOtpExpiry();

    db.prepare(`
      DELETE FROM customer_email_otps
      WHERE customer_id = ?
    `).run(customer.id);

    db.prepare(`
      INSERT INTO customer_email_otps (
        customer_id,
        email,
        otp_hash,
        expires_at,
        attempts,
        last_sent_at
      )
      VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `).run(
      customer.id,
      customer.email,
      otpHash,
      expiresAt
    );

    try {
      await sendCustomerEmailOtp({
        to: customer.email,
        customerName: customer.name,
        otp
      });
    } catch (emailError) {
      db.prepare(`
        DELETE FROM customer_email_otps
        WHERE customer_id = ?
      `).run(customer.id);

      console.error(
        "Customer OTP resend email error:",
        emailError.message
      );

      return res.status(503).json({
        success: false,
        message: "Unable to send verification email. Please try again."
      });
    }

    return res.json({
      success: true,
      message: "A new verification OTP has been sent to your email"
    });
  } catch (error) {
    console.error(
      "Customer OTP resend error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Unable to resend verification OTP"
    });
  }
});

// CUSTOMER LOGIN
router.post("/login", (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password || password.length > 72) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const customer = db.prepare(`
      SELECT
        id,
        name,
        email,
        phone,
        password_hash,
        is_active,
        email_verified,
        session_version
      FROM customers
      WHERE email = ? AND is_active = 1
    `).get(email);

    if (
      !customer ||
      !bcrypt.compareSync(password, customer.password_hash)
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    if (Number(customer.email_verified) !== 1) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in"
      });
    }

    const token = createToken(
      customer.id,
      customer.session_version
    );

    return res.json({
      success: true,
      message: "Login successful",
      data: {
        token,
        customer: publicCustomer(customer)
      }
    });
  } catch (error) {
    console.error("Customer login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to login"
    });
  }
});

// CHANGE CUSTOMER PASSWORD
router.patch("/password", requireCustomer, (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required"
      });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters and at most 72 bytes"
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password"
      });
    }

    const customer = db.prepare(`
      SELECT id, password_hash
      FROM customers
      WHERE id = ? AND is_active = 1
    `).get(req.customer.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer account not found"
      });
    }

    const currentPasswordValid = bcrypt.compareSync(
      currentPassword,
      customer.password_hash
    );

    if (!currentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect"
      });
    }

    const newPasswordHash = bcrypt.hashSync(newPassword, 12);

    db.prepare(`
      UPDATE customers
      SET password_hash = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newPasswordHash, customer.id);

    return res.json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error) {
    console.error("Customer password change error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to change password"
    });
  }
});

// CUSTOMER PROFILE
router.get("/me", requireCustomer, (req, res) => {
  return res.json({
    success: true,
    data: {
      customer: publicCustomer(req.customer)
    }
  });
});

export default router;

