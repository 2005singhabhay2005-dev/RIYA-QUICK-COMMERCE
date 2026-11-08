import { Router } from "express";
import db from "../database.js";
import { requireRider } from "../middleware/rider-auth.js";

const router = Router();

router.use(requireRider);

// GET /api/rider/orders - only this rider's assigned orders
router.get("/orders", (req, res) => {
  try {
        const orderSummary = db.prepare(`
      ...
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
      data: orders
    });
  } catch (error) {
    console.error("Rider orders error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load assigned orders"
    });
  }
});

// GET /api/rider/orders/:id - only assigned order details
router.get("/orders/:id", (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID"
      });
    }

    const order = db.prepare(`
      SELECT
        id,
        order_number,
        customer_name,
        customer_phone,
        delivery_address,
        delivery_city,
        delivery_state,
        delivery_pincode,
        total_amount,
        payment_method,
        payment_status,
        status,
        created_at,
        updated_at
      FROM orders
      WHERE id = ? AND assigned_rider_id = ?
    `).get(id, req.rider.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Assigned order not found"
      });
    }

    const items = db.prepare(`
      SELECT
        product_name,
        sku,
        quantity,
        unit_price,
        line_total
      FROM order_items
      WHERE order_id = ?
      ORDER BY id
    `).all(id);

    const events = db.prepare(`
      SELECT
        old_status,
        new_status,
        note,
        created_at
      FROM order_events
      WHERE order_id = ?
      ORDER BY created_at DESC, id DESC
    `).all(id);

    return res.json({
      success: true,
      data: {
        ...order,
        items,
        events
      }
    });
  } catch (error) {
    console.error("Rider order detail error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load order details"
    });
  }
});

// PATCH /api/rider/orders/:id/delivered
router.patch("/orders/:id/delivered", (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID"
      });
    }

    const completeDelivery = db.transaction(() => {
      const order = db.prepare(`
        SELECT id, order_number, status
        FROM orders
        WHERE id = ? AND assigned_rider_id = ?
      `).get(id, req.rider.id);

      if (!order) {
        return { error: "NOT_FOUND" };
      }

      if (order.status !== "Out for Delivery") {
        return {
          error: "INVALID_STATUS",
          current: order.status
        };
      }

      const result = db.prepare(`
        UPDATE orders
        SET status = 'Delivered',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND assigned_rider_id = ?
          AND status = 'Out for Delivery'
      `).run(id, req.rider.id);

      if (result.changes !== 1) {
        return { error: "UPDATE_FAILED" };
      }

      db.prepare(`
        INSERT INTO order_events (
          order_id,
          old_status,
          new_status,
          note,
          changed_by
        )
        VALUES (?, ?, ?, ?, NULL)
      `).run(
        id,
        "Out for Delivery",
        "Delivered",
        `Delivered by rider ${req.rider.name}`
      );

      return {
        success: true,
        order_number: order.order_number,
        old_status: "Out for Delivery",
        new_status: "Delivered"
      };
    });

    const result = completeDelivery();

    if (result.error === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Assigned order not found"
      });
    }

    if (result.error === "INVALID_STATUS") {
      return res.status(409).json({
        success: false,
        message: `Order cannot be delivered from status ${result.current}`
      });
    }

    if (result.error === "UPDATE_FAILED") {
      return res.status(409).json({
        success: false,
        message: "Order status changed. Please refresh."
      });
    }

    return res.json({
      success: true,
      message: "Order marked as delivered",
      data: result
    });
  } catch (error) {
    console.error("Rider delivery update error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to complete delivery"
    });
  }
});

export default router;
