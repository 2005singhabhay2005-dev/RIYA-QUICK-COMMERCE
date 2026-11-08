import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import db from "../database.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

/* ---------------- HELPERS ---------------- */

function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function audit(adminId, action, type, id, details = "") {
  db.prepare(`
    INSERT INTO admin_audit_logs
    (admin_id, action, entity_type, entity_id, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(adminId, action, type, id ?? null, details);
}

function validText(value, max, field) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > max
  ) {
    throw new Error(`${field} is required and must be under ${max} characters`);
  }

  return value.trim();
}

function validMoney(value, field, nullable = false) {
  if (
    nullable &&
    (value === null || value === "" || value === undefined)
  ) {
    return null;
  }

  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number < 0 ||
    number > 100000000
  ) {
    throw new Error(`${field} must be a valid non-negative amount`);
  }

  return number;
}

function validStock(value) {
  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number < 0 ||
    number > 100000000
  ) {
    throw new Error("Stock must be a non-negative whole number");
  }

  return number;
}

function sendError(res, error) {
  const message = error?.message || "Request failed";

  if (message.includes("UNIQUE constraint failed")) {
    return res.status(409).json({
      success: false,
      message: "A record with this name, slug, or SKU already exists"
    });
  }

  return res.status(400).json({
    success: false,
    message
  });
}

const productSelect = `
  SELECT
    p.id,
    p.name,
    p.slug,
    p.description,
    p.category_id AS categoryId,
    p.price,
    p.original_price AS originalPrice,
    p.stock,
    p.image_url AS imageUrl,
    p.sku,
    p.is_active AS isActive,
    p.created_at AS createdAt,
    p.updated_at AS updatedAt,
    c.name AS category,
    c.slug AS categorySlug
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
`;

/* ---------------- ADMIN LOGIN ---------------- */

router.post("/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!email || !password || password.length > 200) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required"
    });
  }

  const admin = db.prepare(`
    SELECT *
    FROM admin_users
    WHERE email = ? AND is_active = 1
  `).get(email);

  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password"
    });
  }

  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    return res.status(500).json({
      success: false,
      message: "JWT_SECRET must contain at least 32 characters"
    });
  }

  const token = jwt.sign(
    { role: admin.role },
    secret,
    {
      subject: String(admin.id),
      issuer: "riya-quick-commerce",
      expiresIn: "8h"
    }
  );

  res.json({
    success: true,
    data: {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role
      }
    }
  });
});

/* All routes below require authentication */
router.use(requireAdmin);
// CUSTOMER MANAGEMENT
router.get("/customers", (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "all").trim().toLowerCase();

    const conditions = [];
    const params = [];

    if (search) {
      conditions.push(`
        (
          c.name LIKE ?
          OR c.email LIKE ?
          OR c.phone LIKE ?
          OR CAST(c.id AS TEXT) LIKE ?
        )
      `);

      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (status === "active") {
      conditions.push("c.is_active = 1");
    } else if (status === "inactive") {
      conditions.push("c.is_active = 0");
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const customers = db.prepare(`
      SELECT
        c.id,
        c.name,
        c.email,
        c.phone,
        c.is_active,
        c.session_version,
        c.created_at,
        c.updated_at,
        (
          SELECT COUNT(*)
          FROM orders o
          WHERE o.customer_id = c.id
        ) AS order_count
      FROM customers c
      ${whereClause}
      ORDER BY c.id DESC
    `).all(...params);

    return res.json({
      success: true,
      data: {
        customers
      }
    });
  } catch (error) {
    console.error("Admin customer list error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load customers"
    });
  }
});

router.get("/customers/:id", (req, res) => {
  try {
    const customerId = Number(req.params.id);

    if (!Number.isSafeInteger(customerId) || customerId < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID"
      });
    }

    const customer = db.prepare(`
      SELECT
        id,
        name,
        email,
        phone,
        is_active,
        session_version,
        created_at,
        updated_at
      FROM customers
      WHERE id = ?
    `).get(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    const profile = db.prepare(`
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

    const addresses = db.prepare(`
      SELECT
        id,
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
      ORDER BY is_default DESC, id DESC
    `).all(customerId);

    const orderSummary = db.prepare(`
      SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END), 0) AS delivered_orders,
        COALESCE(SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END), 0) AS cancelled_orders,
        COALESCE(SUM(total_amount), 0) AS total_spent
      FROM orders
      WHERE customer_id = ?
    `).get(customerId);
        const orders = db.prepare(`
      SELECT
        id,
        order_number,
        subtotal,
        delivery_fee,
        discount,
        total_amount,
        payment_method,
        payment_status,
        status,
        delivery_address,
        delivery_city,
        delivery_state,
        delivery_pincode,
        customer_notes,
        cancellation_reason,
        assigned_rider_id,
        created_at,
        updated_at
      FROM orders
      WHERE customer_id = ?
      ORDER BY created_at DESC, id DESC
    `).all(customerId);

    return res.json({
      success: true,
      data: {
        customer,
        profile: profile || null,
           addresses,
          orderSummary,
          orders
      }
    });
  } catch (error) {
    console.error("Admin customer details error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load customer details"
    });
  }
});

router.patch("/customers/:id/status", (req, res) => {
  try {
    const customerId = Number(req.params.id);
    const isActive =
      req.body?.is_active === true ||
      req.body?.is_active === 1 ||
      req.body?.is_active === "1";

    if (!Number.isSafeInteger(customerId) || customerId < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID"
      });
    }

    const customer = db.prepare(`
      SELECT id, name, email, is_active, session_version
      FROM customers
      WHERE id = ?
    `).get(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    const nextStatus = isActive ? 1 : 0;

    if (customer.is_active === nextStatus) {
      return res.json({
        success: true,
        message: `Customer is already ${nextStatus ? "active" : "inactive"}`,
        data: {
          id: customer.id,
          is_active: customer.is_active
        }
      });
    }

    const update = db.prepare(`
      UPDATE customers
      SET is_active = ?,
          session_version = session_version + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nextStatus, customerId);

    audit(
      req.admin.id,
      nextStatus ? "activate" : "deactivate",
      "customer",
      customerId,
      `${customer.email} | previous_status=${customer.is_active} | new_status=${nextStatus}`
    );

    return res.json({
      success: true,
      message: `Customer ${nextStatus ? "activated" : "deactivated"} successfully`,
      data: {
        id: customerId,
        is_active: nextStatus,
        session_version: customer.session_version + 1
      }
    });
  } catch (error) {
    console.error("Admin customer status error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update customer status"
    });
  }
});

router.post("/customers/:id/force-logout", (req, res) => {
  try {
    const customerId = Number(req.params.id);

    if (!Number.isSafeInteger(customerId) || customerId < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID"
      });
    }

    const customer = db.prepare(`
      SELECT id, email, session_version
      FROM customers
      WHERE id = ?
    `).get(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    const nextSessionVersion = customer.session_version + 1;

    db.prepare(`
      UPDATE customers
      SET session_version = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nextSessionVersion, customerId);

    audit(
      req.admin.id,
      "force_logout",
      "customer",
      customerId,
      `${customer.email} | session_version ${customer.session_version} -> ${nextSessionVersion}`
    );

    return res.json({
      success: true,
      message: "Customer sessions revoked successfully",
      data: {
        id: customerId,
        session_version: nextSessionVersion
      }
    });
  } catch (error) {
    console.error("Admin customer force logout error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to revoke customer sessions"
    });
  }
});

router.post("/customers/:id/reset-password", (req, res) => {
  try {
    const customerId = Number(req.params.id);
    const newPassword = String(req.body?.newPassword || "");

    if (!Number.isSafeInteger(customerId) || customerId < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID"
      });
    }

    if (
      newPassword.length < 8 ||
      Buffer.byteLength(newPassword, "utf8") > 72
    ) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters and at most 72 bytes"
      });
    }

    const customer = db.prepare(`
      SELECT id, email, session_version
      FROM customers
      WHERE id = ?
    `).get(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    const passwordHash = bcrypt.hashSync(newPassword, 12);
    const nextSessionVersion = customer.session_version + 1;

    db.prepare(`
      UPDATE customers
      SET password_hash = ?,
          session_version = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      passwordHash,
      nextSessionVersion,
      customerId
    );

    audit(
      req.admin.id,
      "reset_password",
      "customer",
      customerId,
      `${customer.email} | session_version ${customer.session_version} -> ${nextSessionVersion}`
    );

    return res.json({
      success: true,
      message: "Customer password reset successfully",
      data: {
        id: customerId,
        session_version: nextSessionVersion
      }
    });
  } catch (error) {
    console.error("Admin customer password reset error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to reset customer password"
    });
  }
});

/* ---------------- ADMIN PROFILE ---------------- */

router.get("/me", (req, res) => {
  res.json({
    success: true,
    data: req.admin
  });
});

/* ---------------- DASHBOARD ---------------- */

router.get("/dashboard", (req, res) => {
  const products = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN is_active = 1 AND stock <= 5 THEN 1 ELSE 0 END) AS lowStock,
      SUM(CASE WHEN is_active = 1 AND stock = 0 THEN 1 ELSE 0 END) AS outOfStock
    FROM products
  `).get();

  const categories = db.prepare(`
    SELECT COUNT(*) AS total FROM categories
  `).get().total;

  const recentLogs = db.prepare(`
    SELECT
      l.id,
      l.product_id AS productId,
      p.name AS productName,
      l.change_amount AS changeAmount,
      l.previous_stock AS previousStock,
      l.new_stock AS newStock,
      l.reason,
      l.created_at AS createdAt
    FROM inventory_logs l
    JOIN products p ON p.id = l.product_id
    ORDER BY l.id DESC
    LIMIT 8
  `).all();

  res.json({
    success: true,
    data: {
      products,
      categories,
      recentLogs
    }
  });
});

/* ---------------- PRODUCT LIST ---------------- */

router.get("/products", (req, res) => {
  const search = String(req.query.search || "").trim().slice(0, 100);
  const status = String(req.query.status || "all");

  const page = Math.max(
    1,
    Number.parseInt(req.query.page, 10) || 1
  );

  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 50)
  );

  const conditions = [];
  const params = [];

  if (status === "active") conditions.push("p.is_active = 1");
  if (status === "inactive") conditions.push("p.is_active = 0");

  if (search) {
    conditions.push(
      "(p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)"
    );

    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const total = db.prepare(`
    SELECT COUNT(*) AS total
    FROM products p
    ${where}
  `).get(...params).total;

  const data = db.prepare(`
    ${productSelect}
    ${where}
    ORDER BY p.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, (page - 1) * limit);

  res.json({
    success: true,
    data,
    total,
    page,
    limit
  });
});

/* ---------------- ADD PRODUCT ---------------- */

router.post("/products", (req, res) => {
  try {
    const body = req.body || {};

    const name = validText(body.name, 150, "Product name");

    const description =
      typeof body.description === "string"
        ? body.description.trim().slice(0, 2000)
        : "";

    const categoryId = Number(body.categoryId);

    const categoryExists = db.prepare(`
      SELECT id FROM categories WHERE id = ?
    `).get(categoryId);

    if (!Number.isInteger(categoryId) || !categoryExists) {
      throw new Error("Select a valid category");
    }

    const price = validMoney(body.price, "Price");
    const originalPrice = validMoney(
      body.originalPrice,
      "MRP",
      true
    );

    const stock = validStock(body.stock ?? 0);

    const sku = body.sku
      ? validText(body.sku, 80, "SKU")
      : null;

    const imageUrl =
      typeof body.imageUrl === "string"
        ? body.imageUrl.trim().slice(0, 1000)
        : "";

    if (imageUrl && !/^https?:\/\/\S+$/i.test(imageUrl)) {
      throw new Error("Image URL must start with http:// or https://");
    }

    if (originalPrice !== null && originalPrice < price) {
      throw new Error("MRP cannot be lower than selling price");
    }

    const slug = slugify(name);

    if (!slug) {
      throw new Error("Invalid product name");
    }

    const transaction = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO products
        (
          name,
          slug,
          description,
          category_id,
          price,
          original_price,
          stock,
          image_url,
          sku
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        name,
        slug,
        description,
        categoryId,
        price,
        originalPrice,
        stock,
        imageUrl,
        sku
      );

      if (stock > 0) {
        db.prepare(`
          INSERT INTO inventory_logs
          (
            product_id,
            change_amount,
            previous_stock,
            new_stock,
            reason
          )
          VALUES (?, ?, 0, ?, 'Initial stock')
        `).run(result.lastInsertRowid, stock, stock);
      }

      audit(
        req.admin.id,
        "create",
        "product",
        result.lastInsertRowid,
        name
      );

      return result.lastInsertRowid;
    });

    const id = transaction();

    const product = db.prepare(`
      ${productSelect}
      WHERE p.id = ?
    `).get(id);

    res.status(201).json({
      success: true,
      data: product
    });

  } catch (error) {
    sendError(res, error);
  }
});

/* ---------------- UPDATE PRODUCT ---------------- */

router.put("/products/:id", (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      throw new Error("Invalid product ID");
    }

    const current = db.prepare(`
      SELECT * FROM products WHERE id = ?
    `).get(id);

    if (!current) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    const body = req.body || {};

    const name = validText(body.name, 150, "Product name");

    const description =
      typeof body.description === "string"
        ? body.description.trim().slice(0, 2000)
        : "";

    const categoryId = Number(body.categoryId);

    if (
      !Number.isInteger(categoryId) ||
      !db.prepare("SELECT id FROM categories WHERE id = ?").get(categoryId)
    ) {
      throw new Error("Select a valid category");
    }

    const price = validMoney(body.price, "Price");

    const originalPrice = validMoney(
      body.originalPrice,
      "MRP",
      true
    );

    const sku = body.sku
      ? validText(body.sku, 80, "SKU")
      : null;

    const imageUrl =
      typeof body.imageUrl === "string"
        ? body.imageUrl.trim().slice(0, 1000)
        : "";

    if (imageUrl && !/^https?:\/\/\S+$/i.test(imageUrl)) {
      throw new Error("Invalid image URL");
    }

    if (originalPrice !== null && originalPrice < price) {
      throw new Error("MRP cannot be lower than selling price");
    }

    db.prepare(`
      UPDATE products
      SET
        name = ?,
        slug = ?,
        description = ?,
        category_id = ?,
        price = ?,
        original_price = ?,
        image_url = ?,
        sku = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name,
      slugify(name),
      description,
      categoryId,
      price,
      originalPrice,
      imageUrl,
      sku,
      id
    );

    audit(req.admin.id, "update", "product", id, name);

    const product = db.prepare(`
      ${productSelect}
      WHERE p.id = ?
    `).get(id);

    res.json({
      success: true,
      data: product
    });

  } catch (error) {
    sendError(res, error);
  }
});

/* ---------------- ACTIVATE / DEACTIVATE ---------------- */

router.patch("/products/:id/status", (req, res) => {
  const id = Number(req.params.id);
  const active = req.body?.isActive;

  if (
    !Number.isInteger(id) ||
    id < 1 ||
    typeof active !== "boolean"
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid product ID and isActive boolean are required"
    });
  }

  const result = db.prepare(`
    UPDATE products
    SET is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(active ? 1 : 0, id);

  if (!result.changes) {
    return res.status(404).json({
      success: false,
      message: "Product not found"
    });
  }

  audit(
    req.admin.id,
    active ? "activate" : "deactivate",
    "product",
    id
  );

  res.json({
    success: true,
    message: active ? "Product activated" : "Product deactivated"
  });
});

/* ---------------- STOCK UPDATE ---------------- */

router.patch("/products/:id/stock", (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      throw new Error("Invalid product ID");
    }

    const stock = validStock(req.body?.stock);

    const reason = validText(
      String(req.body?.reason || "Manual stock update"),
      200,
      "Reason"
    );

    const transaction = db.transaction(() => {
      const product = db.prepare(`
        SELECT id, stock
        FROM products
        WHERE id = ?
      `).get(id);

      if (!product) {
        throw new Error("Product not found");
      }

      const change = stock - product.stock;

      db.prepare(`
        UPDATE products
        SET stock = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(stock, id);

      db.prepare(`
        INSERT INTO inventory_logs
        (
          product_id,
          change_amount,
          previous_stock,
          new_stock,
          reason
        )
        VALUES (?, ?, ?, ?, ?)
      `).run(
        id,
        change,
        product.stock,
        stock,
        reason
      );

      audit(
        req.admin.id,
        "stock_update",
        "product",
        id,
        `${product.stock} -> ${stock}: ${reason}`
      );

      return {
        previousStock: product.stock,
        newStock: stock,
        changeAmount: change
      };
    });

    res.json({
      success: true,
      data: transaction()
    });

  } catch (error) {
    const status = error.message === "Product not found" ? 404 : 400;

    res.status(status).json({
      success: false,
      message: error.message
    });
  }
});

/* ---------------- CATEGORY LIST ---------------- */

router.get("/categories", (req, res) => {
  const data = db.prepare(`
    SELECT
      c.id,
      c.name,
      c.slug,
      c.description,
      COUNT(p.id) AS productCount
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `).all();

  res.json({
    success: true,
    data
  });
});

/* ---------------- ADD CATEGORY ---------------- */

router.post("/categories", (req, res) => {
  try {
    const name = validText(req.body?.name, 100, "Category name");

    const description =
      typeof req.body?.description === "string"
        ? req.body.description.trim().slice(0, 500)
        : "";

    const slug = slugify(name);

    if (!slug) {
      throw new Error("Invalid category name");
    }

    const result = db.prepare(`
      INSERT INTO categories (name, slug, description)
      VALUES (?, ?, ?)
    `).run(name, slug, description);

    audit(req.admin.id, "create", "category", result.lastInsertRowid, name);

    res.status(201).json({
      success: true,
      data: db.prepare(`
        SELECT * FROM categories WHERE id = ?
      `).get(result.lastInsertRowid)
    });

  } catch (error) {
    sendError(res, error);
  }
});

/* ---------------- UPDATE CATEGORY ---------------- */

router.put("/categories/:id", (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      throw new Error("Invalid category ID");
    }

    const name = validText(req.body?.name, 100, "Category name");

    const description =
      typeof req.body?.description === "string"
        ? req.body.description.trim().slice(0, 500)
        : "";

    const result = db.prepare(`
      UPDATE categories
      SET name = ?, slug = ?, description = ?
      WHERE id = ?
    `).run(name, slugify(name), description, id);

    if (!result.changes) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    audit(req.admin.id, "update", "category", id, name);

    res.json({
      success: true,
      data: db.prepare(`
        SELECT * FROM categories WHERE id = ?
      `).get(id)
    });

  } catch (error) {
    sendError(res, error);
  }
});

/* ---------------- INVENTORY HISTORY ---------------- */

router.get("/inventory/logs", (req, res) => {
  const limit = Math.min(
    200,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 50)
  );

  const data = db.prepare(`
    SELECT
      l.id,
      l.product_id AS productId,
      p.name AS productName,
      p.sku,
      l.change_amount AS changeAmount,
      l.previous_stock AS previousStock,
      l.new_stock AS newStock,
      l.reason,
      l.created_at AS createdAt
    FROM inventory_logs l
    JOIN products p ON p.id = l.product_id
    ORDER BY l.id DESC
    LIMIT ?
  `).all(limit);

  res.json({
    success: true,
    data
  });
});

/* ---------------- ADMIN ACTIVITY HISTORY ---------------- */

router.get("/audit-logs", (req, res) => {
  const limit = Math.min(
    200,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 50)
  );

  const data = db.prepare(`
    SELECT
      a.id,
      a.action,
      a.entity_type AS entityType,
      a.entity_id AS entityId,
      a.details,
      a.created_at AS createdAt,
      u.email AS adminEmail
    FROM admin_audit_logs a
    LEFT JOIN admin_users u ON u.id = a.admin_id
    ORDER BY a.id DESC
    LIMIT ?
  `).all(limit);

  res.json({
    success: true,
    data
  });
});

export default router;