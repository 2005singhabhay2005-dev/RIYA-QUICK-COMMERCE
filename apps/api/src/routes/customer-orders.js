import { Router } from "express";
import { randomUUID } from "node:crypto";

import db from "../database.js";
import { requireCustomer } from "../middleware/customer-auth.js";

const router = Router();

router.use(requireCustomer);

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Place a Cash on Delivery order
router.post("/", (req, res) => {
  try {
    const {
      items,
      delivery_address,
      delivery_city,
      delivery_state,
      delivery_pincode,
      customer_notes
    } = req.body || {};

    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Please provide between 1 and 50 order items."
      });
    }

    if (
      !clean(delivery_address) ||
      !clean(delivery_city) ||
      !clean(delivery_state) ||
      !/^\d{6}$/.test(clean(delivery_pincode))
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid delivery address, city, state and 6-digit pincode are required."
      });
    }

    const paymentMethod = clean(req.body.payment_method || "COD").toUpperCase();

    if (paymentMethod !== "COD") {
      return res.status(400).json({
        success: false,
        message: "Online payment is not available yet. Please select COD."
      });
    }

    const quantities = new Map();

    for (const item of items) {
      const productId = Number(item.product_id);
      const quantity = Number(item.quantity);

      if (
        !Number.isSafeInteger(productId) ||
        productId <= 0 ||
        !Number.isSafeInteger(quantity) ||
        quantity <= 0 ||
        quantity > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID or quantity."
        });
      }

      const nextQuantity = (quantities.get(productId) || 0) + quantity;

      if (nextQuantity > 100) {
        return res.status(400).json({
          success: false,
          message: "Maximum quantity per product is 100."
        });
      }

      quantities.set(productId, nextQuantity);
    }

    const deliveryFee = Number(process.env.DELIVERY_FEE || 0);

    if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
      return res.status(500).json({
        success: false,
        message: "Invalid delivery fee configuration."
      });
    }

    const placeOrder = db.transaction(() => {
      const customer = db.prepare(`
        SELECT id, name, email, phone
        FROM customers
        WHERE id = ? AND is_active = 1
      `).get(req.customer.id);

      if (!customer) {
        const error = new Error("Customer account is not active.");
        error.status = 401;
        throw error;
      }

      const orderItems = [];
      let subtotal = 0;

      for (const [productId, quantity] of quantities.entries()) {
        const product = db.prepare(`
          SELECT id, name, sku, price, stock
          FROM products
          WHERE id = ? AND is_active = 1
        `).get(productId);

        if (!product) {
          const error = new Error(`Product ${productId} is unavailable.`);
          error.status = 400;
          throw error;
        }

        if (Number(product.stock) < quantity) {
          const error = new Error(`Insufficient stock for ${product.name}.`);
          error.status = 409;
          throw error;
        }

        const unitPrice = Number(product.price);

        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          const error = new Error(`Invalid price for ${product.name}.`);
          error.status = 500;
          throw error;
        }

        const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
        subtotal += lineTotal;

        orderItems.push({
          product_id: product.id,
          product_name: product.name,
          sku: product.sku || null,
          quantity,
          unit_price: unitPrice,
          line_total: lineTotal,
          previous_stock: Number(product.stock)
        });
      }

      subtotal = Math.round(subtotal * 100) / 100;
      const totalAmount = Math.round((subtotal + deliveryFee) * 100) / 100;
      const orderNumber = `RS-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;

      const orderResult = db.prepare(`
        INSERT INTO orders (
          order_number, customer_name, customer_email, customer_phone,
          delivery_address, delivery_city, delivery_state, delivery_pincode,
          subtotal, delivery_fee, discount, total_amount,
          payment_method, payment_status, status, customer_notes, customer_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderNumber,
        customer.name,
        customer.email,
        customer.phone || "",
        clean(delivery_address),
        clean(delivery_city),
        clean(delivery_state),
        clean(delivery_pincode),
        subtotal,
        deliveryFee,
        0,
        totalAmount,
        "COD",
        "Pending",
        "Placed",
        clean(customer_notes),
        customer.id
      );

      const orderId = Number(orderResult.lastInsertRowid);

      const insertItem = db.prepare(`
        INSERT INTO order_items (
          order_id, product_id, product_name, sku,
          quantity, unit_price, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const reduceStock = db.prepare(`
        UPDATE products
        SET stock = stock - ?
        WHERE id = ? AND is_active = 1 AND stock >= ?
      `);

      const insertInventoryLog = db.prepare(`
        INSERT INTO inventory_logs (
          product_id, change_amount, previous_stock, new_stock, reason
        ) VALUES (?, ?, ?, ?, ?)
      `);

      for (const item of orderItems) {
        const update = reduceStock.run(
          item.quantity,
          item.product_id,
          item.quantity
        );

        if (update.changes !== 1) {
          const error = new Error(
            `Stock changed for ${item.product_name}. Please try again.`
          );
          error.status = 409;
          throw error;
        }

        insertItem.run(
          orderId,
          item.product_id,
          item.product_name,
          item.sku,
          item.quantity,
          item.unit_price,
          item.line_total
        );

        insertInventoryLog.run(
          item.product_id,
          -item.quantity,
          item.previous_stock,
          item.previous_stock - item.quantity,
          `Customer order ${orderNumber}`
        );
      }

      db.prepare(`
        INSERT INTO order_events (
          order_id, old_status, new_status, note, changed_by
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        orderId,
        null,
        "Placed",
        "Order placed by customer",
        null
      );

      return {
        id: orderId,
        order_number: orderNumber,
        subtotal,
        delivery_fee: deliveryFee,
        discount: 0,
        total_amount: totalAmount,
        payment_method: "COD",
        payment_status: "Pending",
        status: "Placed",
        items: orderItems.map(({ previous_stock, ...item }) => item)
      };
    });

    const order = placeOrder();

    return res.status(201).json({
      success: true,
      message: "Order placed successfully.",
      order
    });
  } catch (error) {
    console.error("Customer order error:", error);

    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Unable to place order."
    });
  }
});

// Current customer's order history
router.get("/", (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT id, order_number, subtotal, delivery_fee, discount,
             total_amount, payment_method, payment_status, status,
             created_at, updated_at
      FROM orders
      WHERE customer_id = ?
      ORDER BY created_at DESC, id DESC
    `).all(req.customer.id);

    return res.json({ success: true, orders });
  } catch (error) {
    console.error("Customer order history error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch orders."
    });
  }
});

// A customer can access only their own order
router.get("/:id", (req, res) => {
  try {
    const orderId = Number(req.params.id);

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID."
      });
    }

    const order = db.prepare(`
      SELECT *
      FROM orders
      WHERE id = ? AND customer_id = ?
    `).get(orderId, req.customer.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    const items = db.prepare(`
      SELECT id, product_id, product_name, sku,
             quantity, unit_price, line_total
      FROM order_items
      WHERE order_id = ?
    `).all(orderId);

    const events = db.prepare(`
      SELECT old_status, new_status, note, created_at
      FROM order_events
      WHERE order_id = ?
      ORDER BY created_at ASC, id ASC
    `).all(orderId);

    return res.json({
      success: true,
      order: { ...order, items, events }
    });
  } catch (error) {
    console.error("Customer order detail error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch order details."
    });
  }
});
// Cancel an order owned by the logged-in customer
router.patch("/:id/cancel", (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const reason = clean(req.body?.reason);

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID."
      });
    }

    if (!reason || reason.length > 500) {
      return res.status(400).json({
        success: false,
        message: "A cancellation reason (maximum 500 characters) is required."
      });
    }

    const cancelOrder = db.transaction(() => {
      const order = db.prepare(`
        SELECT id, order_number, status
        FROM orders
        WHERE id = ? AND customer_id = ?
      `).get(orderId, req.customer.id);

      if (!order) {
        return { error: "NOT_FOUND" };
      }

      if (!["Placed", "Confirmed"].includes(order.status)) {
        return {
          error: "CANCELLATION_NOT_ALLOWED",
          current: order.status
        };
      }

      const items = db.prepare(`
        SELECT product_id, product_name, quantity
        FROM order_items
        WHERE order_id = ?
      `).all(orderId);

      const restoreStock = db.prepare(`
        UPDATE products
        SET stock = stock + ?
        WHERE id = ?
      `);

      const insertLog = db.prepare(`
        INSERT INTO inventory_logs (
          product_id, change_amount, previous_stock, new_stock, reason
        ) VALUES (?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        const product = db.prepare(`
          SELECT stock FROM products WHERE id = ?
        `).get(item.product_id);

        if (!product) {
          throw new Error(`Product ${item.product_id} not found.`);
        }

        const previousStock = Number(product.stock);
        const quantity = Number(item.quantity);
        const newStock = previousStock + quantity;

        restoreStock.run(quantity, item.product_id);

        insertLog.run(
          item.product_id,
          quantity,
          previousStock,
          newStock,
          `Customer cancelled order ${order.order_number}`
        );
      }

      db.prepare(`
        UPDATE orders
        SET status = 'Cancelled',
            cancellation_reason = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND customer_id = ?
      `).run(reason, orderId, req.customer.id);

      db.prepare(`
        INSERT INTO order_events (
          order_id, old_status, new_status, note, changed_by
        ) VALUES (?, ?, ?, ?, NULL)
      `).run(
        orderId,
        order.status,
        "Cancelled",
        reason
      );

      return {
        success: true,
        old_status: order.status,
        new_status: "Cancelled"
      };
    });

    const result = cancelOrder();

    if (result.error === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    if (result.error === "CANCELLATION_NOT_ALLOWED") {
      return res.status(409).json({
        success: false,
        message: `Order cannot be cancelled from ${result.current} status.`
      });
    }

    return res.json({
      success: true,
      message: "Order cancelled and inventory restored.",
      data: result
    });
  } catch (error) {
    console.error("Customer order cancellation error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to cancel order."
    });
  }
});

export default router;
