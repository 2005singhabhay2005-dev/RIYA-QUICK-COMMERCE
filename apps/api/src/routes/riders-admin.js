import { Router } from "express";
import bcrypt from "bcryptjs";
import db from "../database.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

router.use(requireAdmin);

// GET /api/admin/riders
router.get("/", (req, res) => {
  try {
    const riders = db.prepare(`
      SELECT
        r.id,
        r.name,
        r.phone,
        r.email,
        r.is_active,
        r.created_at,
        r.updated_at,
        COUNT(o.id) AS assigned_orders,
        SUM(CASE WHEN o.status = 'Out for Delivery' THEN 1 ELSE 0 END)
          AS active_deliveries
      FROM riders r
      LEFT JOIN orders o ON o.assigned_rider_id = r.id
      GROUP BY r.id
      ORDER BY r.created_at DESC, r.id DESC
    `).all();

    return res.json({
      success: true,
      data: riders
    });
  } catch (error) {
    console.error("Admin riders list error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load riders"
    });
  }
});

// POST /api/admin/riders
router.post("/", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const phone = String(req.body?.phone || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!name || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, phone and password are required"
      });
    }

    if (name.length > 100 || phone.length > 20 || email.length > 254) {
      return res.status(400).json({
        success: false,
        message: "One or more fields exceed the allowed length"
      });
    }

    if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters and at most 72 bytes"
      });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = db.prepare(`
      INSERT INTO riders (
        name,
        phone,
        email,
        password_hash,
        is_active
      )
      VALUES (?, ?, ?, ?, 1)
    `).run(name, phone, email || null, passwordHash);

    const rider = db.prepare(`
      SELECT id, name, phone, email, is_active, created_at
      FROM riders
      WHERE id = ?
    `).get(result.lastInsertRowid);

    return res.status(201).json({
      success: true,
      message: "Rider created successfully",
      data: rider
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        success: false,
        message: "Phone number or email is already registered"
      });
    }

    console.error("Admin create rider error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to create rider"
    });
  }
});

// PATCH /api/admin/riders/:id
router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid rider ID"
      });
    }

    const existing = db.prepare(`
      SELECT id, name, phone, email, is_active
      FROM riders
      WHERE id = ?
    `).get(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Rider not found"
      });
    }

    const name = req.body?.name === undefined
      ? existing.name
      : String(req.body.name).trim();

    const phone = req.body?.phone === undefined
      ? existing.phone
      : String(req.body.phone).trim();

    const email = req.body?.email === undefined
      ? existing.email
      : String(req.body.email).trim().toLowerCase();

    const password = req.body?.password === undefined
      ? ""
      : String(req.body.password);

    const isActive = req.body?.is_active === undefined
      ? existing.is_active
      : req.body.is_active;

    if (
      !name || !phone ||
      name.length > 100 ||
      phone.length > 20 ||
      String(email || "").length > 254
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid rider name, phone or email"
      });
    }

    if (
      isActive !== 0 &&
      isActive !== 1 &&
      isActive !== false &&
      isActive !== true
    ) {
      return res.status(400).json({
        success: false,
        message: "is_active must be true or false"
      });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address"
      });
    }

    if (
      password &&
      (password.length < 8 || Buffer.byteLength(password, "utf8") > 72)
    ) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters and at most 72 bytes"
      });
    }

    const passwordHash = password
      ? await bcrypt.hash(password, 12)
      : null;

    db.prepare(`
      UPDATE riders
      SET
        name = ?,
        phone = ?,
        email = ?,
        password_hash = COALESCE(?, password_hash),
        is_active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name,
      phone,
      email || null,
      passwordHash,
      isActive ? 1 : 0,
      id
    );

    const updated = db.prepare(`
      SELECT id, name, phone, email, is_active, created_at, updated_at
      FROM riders
      WHERE id = ?
    `).get(id);

    return res.json({
      success: true,
      message: "Rider updated successfully",
      data: updated
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        success: false,
        message: "Phone number or email is already registered"
      });
    }

    console.error("Admin update rider error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update rider"
    });
  }
});

// PATCH /api/admin/riders/:id/deactivate
router.patch("/:id/deactivate", (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid rider ID"
      });
    }

    const result = db.prepare(`
      UPDATE riders
      SET is_active = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: "Rider not found"
      });
    }

    return res.json({
      success: true,
      message: "Rider deactivated successfully"
    });
  } catch (error) {
    console.error("Admin deactivate rider error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to deactivate rider"
    });
  }
});

export default router;
