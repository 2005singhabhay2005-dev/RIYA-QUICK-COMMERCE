import { Router } from "express";

import db from "../database.js";
import { requireCustomer } from "../middleware/customer-auth.js";

const router = Router();

router.use(requireCustomer);

function ensureProfile(customerId) {
  db.prepare(`
    INSERT OR IGNORE INTO customer_profiles (customer_id)
    VALUES (?)
  `).run(customerId);

  return db.prepare(`
    SELECT
      id,
      customer_id,
      date_of_birth,
      gender,
      avatar_url,
      language,
      currency,
      created_at,
      updated_at
    FROM customer_profiles
    WHERE customer_id = ?
  `).get(customerId);
}

function normalizeText(value, maxLength = 255) {
  return String(value ?? "").trim().slice(0, maxLength);
}

// ============================================================
// CUSTOMER PROFILE
// ============================================================

router.get("/", (req, res) => {
  try {
    const profile = ensureProfile(req.customer.id);

    const customer = db.prepare(`
      SELECT id, name, email, phone
      FROM customers
      WHERE id = ? AND is_active = 1
    `).get(req.customer.id);

    return res.json({
      success: true,
      data: {
        profile: {
          ...profile,
          name: customer.name,
          email: customer.email,
          phone: customer.phone
        }
      }
    });
  } catch (error) {
    console.error("Customer profile fetch error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch customer profile"
    });
  }
});

router.patch("/", (req, res) => {
  try {
    const customerId = req.customer.id;

    const current = db.prepare(`
      SELECT id, name, email, phone
      FROM customers
      WHERE id = ? AND is_active = 1
    `).get(customerId);

    if (!current) {
      return res.status(404).json({
        success: false,
        message: "Customer account not found"
      });
    }

    const name =
      req.body?.name !== undefined
        ? normalizeText(req.body.name, 100)
        : current.name;

    const email =
      req.body?.email !== undefined
        ? normalizeText(req.body.email, 254).toLowerCase()
        : current.email;

    const phone =
      req.body?.phone !== undefined
        ? normalizeText(req.body.phone, 18)
        : current.phone;

    const dateOfBirth =
      req.body?.dateOfBirth !== undefined
        ? normalizeText(req.body.dateOfBirth, 20)
        : undefined;

    const gender =
      req.body?.gender !== undefined
        ? normalizeText(req.body.gender, 30)
        : undefined;

    const avatarUrl =
      req.body?.avatarUrl !== undefined
        ? normalizeText(req.body.avatarUrl, 1000)
        : undefined;

    const language =
      req.body?.language !== undefined
        ? normalizeText(req.body.language, 10)
        : undefined;

    const currency =
      req.body?.currency !== undefined
        ? normalizeText(req.body.currency, 10).toUpperCase()
        : undefined;

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

    const updateProfile = db.transaction(() => {
      db.prepare(`
        UPDATE customers
        SET name = ?,
            email = ?,
            phone = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(name, email, phone, customerId);

      ensureProfile(customerId);

      const fields = [];
      const values = [];

      if (dateOfBirth !== undefined) {
        fields.push("date_of_birth = ?");
        values.push(dateOfBirth);
      }

      if (gender !== undefined) {
        fields.push("gender = ?");
        values.push(gender);
      }

      if (avatarUrl !== undefined) {
        fields.push("avatar_url = ?");
        values.push(avatarUrl);
      }

      if (language !== undefined) {
        fields.push("language = ?");
        values.push(language);
      }

      if (currency !== undefined) {
        fields.push("currency = ?");
        values.push(currency);
      }

      if (fields.length > 0) {
        fields.push("updated_at = CURRENT_TIMESTAMP");

        db.prepare(`
          UPDATE customer_profiles
          SET ${fields.join(", ")}
          WHERE customer_id = ?
        `).run(...values, customerId);
      }
    });

    updateProfile();

    const profile = ensureProfile(customerId);

    const customer = db.prepare(`
      SELECT id, name, email, phone
      FROM customers
      WHERE id = ?
    `).get(customerId);

    return res.json({
      success: true,
      message: "Customer profile updated successfully",
      data: {
        profile: {
          ...profile,
          name: customer.name,
          email: customer.email,
          phone: customer.phone
        }
      }
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists"
      });
    }

    console.error("Customer profile update error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update customer profile"
    });
  }
});

// ============================================================
// SAVED ADDRESSES
// ============================================================

router.get("/addresses", (req, res) => {
  try {
    const addresses = db.prepare(`
      SELECT
        id,
        customer_id,
        label,
        full_name,
        phone,
        address_line1,
        address_line2,
        city,
        state,
        pincode,
        landmark,
        is_default,
        created_at,
        updated_at
      FROM customer_addresses
      WHERE customer_id = ?
      ORDER BY is_default DESC, updated_at DESC, id DESC
    `).all(req.customer.id);

    return res.json({
      success: true,
      data: {
        addresses
      }
    });
  } catch (error) {
    console.error("Customer addresses fetch error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch saved addresses"
    });
  }
});

router.post("/addresses", (req, res) => {
  try {
    const customerId = req.customer.id;

    const label = normalizeText(req.body?.label || "Home", 30);
    const fullName = normalizeText(req.body?.fullName, 100);
    const phone = normalizeText(req.body?.phone, 18);
    const addressLine1 = normalizeText(req.body?.addressLine1, 250);
    const addressLine2 = normalizeText(req.body?.addressLine2, 250);
    const city = normalizeText(req.body?.city, 100);
    const state = normalizeText(req.body?.state, 100);
    const pincode = normalizeText(req.body?.pincode, 6);
    const landmark = normalizeText(req.body?.landmark, 150);
    const isDefault = req.body?.isDefault === true ? 1 : 0;

    if (!fullName || !phone || !addressLine1 || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        message: "Full name, phone, address, city, state and pincode are required"
      });
    }

    if (!/^\+?[0-9\s-]{10,18}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid address phone number"
      });
    }

    if (!/^[0-9]{6}$/.test(pincode)) {
      return res.status(400).json({
        success: false,
        message: "Pincode must contain exactly 6 digits"
      });
    }

    const createAddress = db.transaction(() => {
      if (isDefault) {
        db.prepare(`
          UPDATE customer_addresses
          SET is_default = 0,
              updated_at = CURRENT_TIMESTAMP
          WHERE customer_id = ?
        `).run(customerId);
      }

      const result = db.prepare(`
        INSERT INTO customer_addresses (
          customer_id,
          label,
          full_name,
          phone,
          address_line1,
          address_line2,
          city,
          state,
          pincode,
          landmark,
          is_default
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        customerId,
        label,
        fullName,
        phone,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        landmark,
        isDefault
      );

      // First saved address automatically becomes default.
      const addressCount = db.prepare(`
        SELECT COUNT(*) AS count
        FROM customer_addresses
        WHERE customer_id = ?
      `).get(customerId);

      if (addressCount.count === 1) {
        db.prepare(`
          UPDATE customer_addresses
          SET is_default = 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(result.lastInsertRowid);
      }

      return result.lastInsertRowid;
    });

    const addressId = createAddress();

    const address = db.prepare(`
      SELECT *
      FROM customer_addresses
      WHERE id = ? AND customer_id = ?
    `).get(addressId, customerId);

    return res.status(201).json({
      success: true,
      message: "Address saved successfully",
      data: {
        address
      }
    });
  } catch (error) {
    console.error("Customer address create error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to save address"
    });
  }
});

router.patch("/addresses/:id", (req, res) => {
  try {
    const customerId = req.customer.id;
    const addressId = Number(req.params.id);

    if (!Number.isInteger(addressId) || addressId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid address id"
      });
    }

    const existing = db.prepare(`
      SELECT *
      FROM customer_addresses
      WHERE id = ? AND customer_id = ?
    `).get(addressId, customerId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Address not found"
      });
    }

    const updated = {
      label:
        req.body?.label !== undefined
          ? normalizeText(req.body.label, 30)
          : existing.label,

      fullName:
        req.body?.fullName !== undefined
          ? normalizeText(req.body.fullName, 100)
          : existing.full_name,

      phone:
        req.body?.phone !== undefined
          ? normalizeText(req.body.phone, 18)
          : existing.phone,

      addressLine1:
        req.body?.addressLine1 !== undefined
          ? normalizeText(req.body.addressLine1, 250)
          : existing.address_line1,

      addressLine2:
        req.body?.addressLine2 !== undefined
          ? normalizeText(req.body.addressLine2, 250)
          : existing.address_line2,

      city:
        req.body?.city !== undefined
          ? normalizeText(req.body.city, 100)
          : existing.city,

      state:
        req.body?.state !== undefined
          ? normalizeText(req.body.state, 100)
          : existing.state,

      pincode:
        req.body?.pincode !== undefined
          ? normalizeText(req.body.pincode, 6)
          : existing.pincode,

      landmark:
        req.body?.landmark !== undefined
          ? normalizeText(req.body.landmark, 150)
          : existing.landmark,

      isDefault:
        req.body?.isDefault !== undefined
          ? (req.body.isDefault === true ? 1 : 0)
          : existing.is_default
    };

    if (
      !updated.fullName ||
      !updated.phone ||
      !updated.addressLine1 ||
      !updated.city ||
      !updated.state ||
      !updated.pincode
    ) {
      return res.status(400).json({
        success: false,
        message: "Full name, phone, address, city, state and pincode are required"
      });
    }

    if (!/^\+?[0-9\s-]{10,18}$/.test(updated.phone)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid address phone number"
      });
    }

    if (!/^[0-9]{6}$/.test(updated.pincode)) {
      return res.status(400).json({
        success: false,
        message: "Pincode must contain exactly 6 digits"
      });
    }

    const updateAddress = db.transaction(() => {
      if (updated.isDefault) {
        db.prepare(`
          UPDATE customer_addresses
          SET is_default = 0,
              updated_at = CURRENT_TIMESTAMP
          WHERE customer_id = ?
        `).run(customerId);
      }

      db.prepare(`
        UPDATE customer_addresses
        SET
          label = ?,
          full_name = ?,
          phone = ?,
          address_line1 = ?,
          address_line2 = ?,
          city = ?,
          state = ?,
          pincode = ?,
          landmark = ?,
          is_default = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND customer_id = ?
      `).run(
        updated.label,
        updated.fullName,
        updated.phone,
        updated.addressLine1,
        updated.addressLine2,
        updated.city,
        updated.state,
        updated.pincode,
        updated.landmark,
        updated.isDefault,
        addressId,
        customerId
      );
    });

    updateAddress();

    const address = db.prepare(`
      SELECT *
      FROM customer_addresses
      WHERE id = ? AND customer_id = ?
    `).get(addressId, customerId);

    return res.json({
      success: true,
      message: "Address updated successfully",
      data: {
        address
      }
    });
  } catch (error) {
    console.error("Customer address update error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update address"
    });
  }
});

router.delete("/addresses/:id", (req, res) => {
  try {
    const customerId = req.customer.id;
    const addressId = Number(req.params.id);

    const existing = db.prepare(`
      SELECT id, is_default
      FROM customer_addresses
      WHERE id = ? AND customer_id = ?
    `).get(addressId, customerId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Address not found"
      });
    }

    const removeAddress = db.transaction(() => {
      db.prepare(`
        DELETE FROM customer_addresses
        WHERE id = ? AND customer_id = ?
      `).run(addressId, customerId);

      if (existing.is_default) {
        db.prepare(`
          UPDATE customer_addresses
          SET is_default = 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = (
            SELECT id
            FROM customer_addresses
            WHERE customer_id = ?
            ORDER BY updated_at DESC, id DESC
            LIMIT 1
          )
        `).run(customerId);
      }
    });

    removeAddress();

    return res.json({
      success: true,
      message: "Address deleted successfully"
    });
  } catch (error) {
    console.error("Customer address delete error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to delete address"
    });
  }
});

router.patch("/addresses/:id/default", (req, res) => {
  try {
    const customerId = req.customer.id;
    const addressId = Number(req.params.id);

    const address = db.prepare(`
      SELECT id
      FROM customer_addresses
      WHERE id = ? AND customer_id = ?
    `).get(addressId, customerId);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found"
      });
    }

    const setDefault = db.transaction(() => {
      db.prepare(`
        UPDATE customer_addresses
        SET is_default = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE customer_id = ?
      `).run(customerId);

      db.prepare(`
        UPDATE customer_addresses
        SET is_default = 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND customer_id = ?
      `).run(addressId, customerId);
    });

    setDefault();

    const updatedAddress = db.prepare(`
      SELECT *
      FROM customer_addresses
      WHERE id = ? AND customer_id = ?
    `).get(addressId, customerId);

    return res.json({
      success: true,
      message: "Default address updated successfully",
      data: {
        address: updatedAddress
      }
    });
  } catch (error) {
    console.error("Default customer address error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to set default address"
    });
  }
});

export default router;
