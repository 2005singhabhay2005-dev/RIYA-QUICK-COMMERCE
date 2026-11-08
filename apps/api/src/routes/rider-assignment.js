import { Router } from "express";
import db from "../database.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

router.use(requireAdmin);

// POST /api/admin/orders/:id/assign-rider
router.post("/:id/assign-rider", (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const riderId = Number(req.body?.rider_id);

    if (!Number.isSafeInteger(orderId) || orderId < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID"
      });
    }

    if (!Number.isSafeInteger(riderId) || riderId < 1) {
      return res.status(400).json({
        success: false,
        message: "Valid rider ID is required"
      });
    }

    const assignOrder = db.transaction(() => {
      const order = db.prepare(`
        SELECT id, order_number, status, assigned_rider_id
        FROM orders
        WHERE id = ?
      `).get(orderId);

      if (!order) {
        return { error: "ORDER_NOT_FOUND" };
      }

      if (order.status !== "Ready for Dispatch") {
        return {
          error: "INVALID_ORDER_STATUS",
          current: order.status
        };
      }

      const rider = db.prepare(`
        SELECT id, name, phone, email
        FROM riders
        WHERE id = ? AND is_active = 1
      `).get(riderId);

      if (!rider) {
        return { error: "RIDER_NOT_FOUND" };
      }

      const update = db.prepare(`
        UPDATE orders
        SET
          assigned_rider_id = ?,
          status = 'Out for Delivery',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND status = 'Ready for Dispatch'
          AND assigned_rider_id IS NULL
      `).run(riderId, orderId);

      if (update.changes !== 1) {
        return { error: "ASSIGNMENT_CONFLICT" };
      }

      db.prepare(`
        INSERT INTO order_events (
          order_id,
          old_status,
          new_status,
          note,
          changed_by
        )
        VALUES (?, ?, ?, ?, ?)
      `).run(
        orderId,
        "Ready for Dispatch",
        "Out for Delivery",
        `Assigned to rider ${rider.name} (${rider.phone})`,
        req.admin.id
      );

      return {
        success: true,
        order_number: order.order_number,
        rider
      };
    });

    const result = assignOrder();

    if (result.error === "ORDER_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (result.error === "RIDER_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Active rider not found"
      });
    }

    if (result.error === "INVALID_ORDER_STATUS") {
      return res.status(409).json({
        success: false,
        message: `Only Ready for Dispatch orders can be assigned. Current status: ${result.current}`
      });
    }

    if (result.error === "ASSIGNMENT_CONFLICT") {
      return res.status(409).json({
        success: false,
        message: "Order is already assigned or has changed. Refresh and try again."
      });
    }

    return res.json({
      success: true,
      message: "Order assigned and marked Out for Delivery",
      data: result
    });
  } catch (error) {
    console.error("Rider assignment error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to assign rider"
    });
  }
});

export default router;
