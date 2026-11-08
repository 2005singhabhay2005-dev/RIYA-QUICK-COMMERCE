
import { Router } from "express";
import db from "../database.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

const STATUSES = [
  "Placed",
  "Confirmed",
  "Packed",
  "Ready for Dispatch",
  "Out for Delivery",
  "Delivered",
  "Cancelled"
];

const NEXT_STATUS = {
  "Placed": ["Confirmed"],
  "Confirmed": ["Packed"],
  "Packed": ["Ready for Dispatch"],
  "Ready for Dispatch": [],
  "Out for Delivery": [],
  "Delivered": [],
  "Cancelled": []
};

router.use(requireAdmin);

// GET /api/admin/orders
router.get("/", (req, res) => {
  try {
    const {
      search = "",
      status = "",
      page = "1",
      limit = "20"
    } = req.query;

    const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(limit, 10) || 20)
    );

    const conditions = [];
    const params = [];

    if (status && STATUSES.includes(status)) {
      conditions.push("o.status = ?");
      params.push(status);
    }

    if (String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      conditions.push(`(
        o.order_number LIKE ?
        OR o.customer_name LIKE ?
        OR o.customer_phone LIKE ?
        OR o.customer_email LIKE ?
      )`);
      params.push(term, term, term, term);
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const total = db.prepare(`
      SELECT COUNT(*) AS count
      FROM orders o
      ${where}
    `).get(...params).count;

    const orders = db.prepare(`
      SELECT
        o.id,
        o.order_number,
        o.customer_name,
        o.customer_phone,
        o.delivery_city,
        o.total_amount,
        o.payment_method,
        o.payment_status,
        o.status,
        o.created_at,
        COUNT(oi.id) AS item_count
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      ${where}
      GROUP BY o.id
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, (currentPage - 1) * pageSize);

    res.json({
      success: true,
      data: orders,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error("Orders list error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to load orders"
    });
  }
});

// GET /api/admin/orders/:id
router.get("/:id", (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID"
      });
    }

    const order = db.prepare(`
      SELECT *
      FROM orders
      WHERE id = ?
    `).get(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const items = db.prepare(`
      SELECT
        id,
        product_id,
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
        e.id,
        e.old_status,
        e.new_status,
        e.note,
        e.created_at,
        a.email AS changed_by_email
      FROM order_events e
      LEFT JOIN admin_users a ON a.id = e.changed_by
      WHERE e.order_id = ?
      ORDER BY e.created_at DESC, e.id DESC
    `).all(id);

    res.json({
      success: true,
      data: {
        ...order,
        items,
        events
      }
    });
  } catch (error) {
    console.error("Order detail error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to load order details"
    });
  }
});

// PATCH /api/admin/orders/:id/status
router.patch("/:id/status", (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, note = "", cancellation_reason = "" } = req.body || {};

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID"
      });
    }

    if (!STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status"
      });
    }

    const updateOrder = db.transaction(() => {
      const order = db.prepare(`
               SELECT id, status, order_number
        FROM orders
        WHERE id = ?
      `).get(id);

      if (!order) {
        return { error: "NOT_FOUND" };
      }

      const oldStatus = order.status;

      if (
        status === "Cancelled" &&
        ["Placed", "Confirmed", "Packed", "Ready for Dispatch"].includes(oldStatus)
      ) {
        if (!String(cancellation_reason).trim()) {
          return { error: "CANCELLATION_REASON_REQUIRED" };
        }
      } else if (!(NEXT_STATUS[oldStatus] || []).includes(status)) {
        return {
          error: "INVALID_TRANSITION",
          current: oldStatus
        };
      }

      const reason = status === "Cancelled"
        ? String(cancellation_reason).trim().slice(0, 500)
        : String(note).trim().slice(0, 500);
              // Restore inventory exactly once when an order is cancelled.
      if (status === "Cancelled") {
        const items = db.prepare(`
          SELECT product_id, product_name, quantity
          FROM order_items
          WHERE order_id = ?
        `).all(id);

        const restoreStock = db.prepare(`
          UPDATE products
          SET stock = stock + ?
          WHERE id = ?
        `);

        const insertInventoryLog = db.prepare(`
          INSERT INTO inventory_logs (
            product_id,
            change_amount,
            previous_stock,
            new_stock,
            reason
          ) VALUES (?, ?, ?, ?, ?)
        `);

        for (const item of items) {
          const product = db.prepare(`
            SELECT stock
            FROM products
            WHERE id = ?
          `).get(item.product_id);

          if (!product) {
            throw new Error(
              `Cannot restore stock: product ${item.product_id} not found.`
            );
          }

          const previousStock = Number(product.stock);
          const quantity = Number(item.quantity);
          const newStock = previousStock + quantity;

          restoreStock.run(quantity, item.product_id);

          insertInventoryLog.run(
            item.product_id,
            quantity,
            previousStock,
            newStock,
            `Cancelled order ${order.order_number}`
          );
        }
      }

      db.prepare(`
        UPDATE orders
        SET
          status = ?,
          cancellation_reason = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        status,
        status === "Cancelled" ? reason : "",
        id
      );

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
        id,
        oldStatus,
        status,
        reason,
        req.admin.id
      );

      return {
        success: true,
        old_status: oldStatus,
        new_status: status
      };
    });

    const result = updateOrder();

    if (result.error === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (result.error === "CANCELLATION_REASON_REQUIRED") {
      return res.status(400).json({
        success: false,
        message: "Cancellation reason is required"
      });
    }

    if (result.error === "INVALID_TRANSITION") {
      return res.status(409).json({
        success: false,
        message: `Cannot change order from ${result.current} to ${status}`
      });
    }

    res.json({
      success: true,
      message: "Order status updated",
      data: result
    });
  } catch (error) {
    console.error("Order status update error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to update order status"
    });
  }
});

export default router;
