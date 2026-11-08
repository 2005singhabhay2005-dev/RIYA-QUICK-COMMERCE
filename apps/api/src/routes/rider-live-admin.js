import { Router } from "express";
import db from "../database.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

router.use(requireAdmin);

// GET /api/admin/rider-live
router.get("/", (req, res) => {
  try {
    const riders = db.prepare(`
      SELECT
        r.id,
        r.name,
        r.phone,
        r.email,
        r.is_active,
        COALESCE(p.is_online, 0) AS is_online,
        p.last_seen_at,
        loc.latitude,
        loc.longitude,
        loc.accuracy,
        loc.heading,
        loc.speed,
        loc.recorded_at,
        active_order.id AS active_order_id,
        active_order.order_number AS active_order_number,
        active_order.delivery_address,
        active_order.delivery_city,
        active_order.delivery_pincode
      FROM riders r

      LEFT JOIN rider_presence p
        ON p.rider_id = r.id

      LEFT JOIN rider_locations loc
        ON loc.id = (
          SELECT MAX(l2.id)
          FROM rider_locations l2
          WHERE l2.rider_id = r.id
        )

      LEFT JOIN orders active_order
        ON active_order.id = (
          SELECT o.id
          FROM orders o
          WHERE o.assigned_rider_id = r.id
            AND o.status = 'Out for Delivery'
          ORDER BY o.updated_at DESC, o.id DESC
          LIMIT 1
        )

      WHERE r.is_active = 1
      ORDER BY r.name COLLATE NOCASE
    `).all();

    return res.json({
      success: true,
      data: riders
    });
  } catch (error) {
    console.error("Admin live rider list error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load live rider locations"
    });
  }
});

export default router;