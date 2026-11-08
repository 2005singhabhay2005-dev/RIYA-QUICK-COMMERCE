
import { Router } from "express";
import db from "../database.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

const clean = (value, max = 160) => {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
};

const positiveNumber = (value, max = 100) => {
  const number = Number(value);

  return Number.isFinite(number) &&
    number > 0 &&
    number <= max
      ? number
      : null;
};

/*
 PUBLIC: PIN CODE SERVICEABILITY
*/

router.get("/serviceability", (req, res) => {
  const pincode = clean(req.query.pincode, 6);

  if (!/^[0-9]{6}$/.test(pincode)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid 6-digit PIN code."
    });
  }

  const areas = db.prepare(`
    SELECT
      sa.id AS serviceAreaId,
      sa.name AS serviceArea,
      sa.pincode,
      sa.radius_km AS radiusKm,
      w.id AS warehouseId,
      w.name AS warehouseName,
      w.city,
      w.state

    FROM service_areas sa

    JOIN warehouses w
      ON w.id = sa.warehouse_id

    WHERE
      sa.pincode = ?
      AND sa.is_active = 1
      AND w.is_active = 1

    ORDER BY sa.radius_km ASC
  `).all(pincode);

  return res.json({
    success: true,
    serviceable: areas.length > 0,

    message: areas.length
      ? "Delivery is available."
      : "Delivery is not available for this PIN code.",

    data: areas
  });
});

/*
 ADMIN ROUTES
*/

router.use(requireAdmin);

/*
 WAREHOUSE MANAGEMENT
*/

router.get("/warehouses", (req, res) => {
  const warehouses = db.prepare(`
    SELECT
      w.*,

      (
        SELECT COUNT(*)
        FROM warehouse_inventory wi
        WHERE wi.warehouse_id = w.id
      ) AS inventorySkus,

      (
        SELECT COUNT(*)
        FROM service_areas sa
        WHERE sa.warehouse_id = w.id
          AND sa.is_active = 1
      ) AS activeServiceAreas

    FROM warehouses w
    ORDER BY w.id
  `).all();

  res.json({
    success: true,
    data: warehouses
  });
});

router.post("/warehouses", (req, res) => {
  const name = clean(req.body?.name, 120);

  const code = clean(req.body?.code, 40)
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");

  if (!name || !code) {
    return res.status(400).json({
      success: false,
      message: "Warehouse name and code are required."
    });
  }
  const existingWarehouse = db.prepare(`
  SELECT id
  FROM warehouses
  LIMIT 1
`).get();

if (existingWarehouse) {
  return res.status(409).json({
    success: false,
    message: "Only one warehouse is allowed in the current operating setup.",
    warehouseId: existingWarehouse.id
  });
}

  try {
    const result = db.prepare(`
      INSERT INTO warehouses (
        name,
        code,
        address,
        city,
        state,
        pincode,
        latitude,
        longitude
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      code,
      clean(req.body?.address, 300),
      clean(req.body?.city, 100),
      clean(req.body?.state, 100) || "Uttar Pradesh",
      clean(req.body?.pincode, 6),
      req.body?.latitude == null
        ? null
        : Number(req.body.latitude),
      req.body?.longitude == null
        ? null
        : Number(req.body.longitude)
    );

    res.status(201).json({
      success: true,
      id: result.lastInsertRowid,
      message: "Warehouse created."
    });

  } catch (error) {
    res.status(409).json({
      success: false,
      message: error.message.includes("UNIQUE")
        ? "Warehouse code already exists."
        : "Unable to create warehouse."
    });
  }
});

router.patch("/warehouses/:id/status", (req, res) => {
  if (typeof req.body?.isActive !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "isActive must be boolean."
    });
  }

  const result = db.prepare(`
    UPDATE warehouses
    SET
      is_active = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    req.body.isActive ? 1 : 0,
    Number(req.params.id)
  );

  if (!result.changes) {
    return res.status(404).json({
      success: false,
      message: "Warehouse not found."
    });
  }

  res.json({
    success: true,
    message: "Warehouse status updated."
  });
});

/*
 SERVICE AREA MANAGEMENT
*/

router.get("/service-areas", (req, res) => {
  const areas = db.prepare(`
    SELECT
      sa.*,
      w.name AS warehouseName

    FROM service_areas sa

    JOIN warehouses w
      ON w.id = sa.warehouse_id

    ORDER BY sa.id DESC
  `).all();

  res.json({
    success: true,
    data: areas
  });
});

router.post("/service-areas", (req, res) => {
  const warehouseId = Number(req.body?.warehouseId);
  const name = clean(req.body?.name, 120);
  const pincode = clean(req.body?.pincode, 6);
  const radiusKm = positiveNumber(req.body?.radiusKm);

  if (
    !Number.isInteger(warehouseId) ||
    warehouseId < 1 ||
    !name ||
    !/^[0-9]{6}$/.test(pincode) ||
    !radiusKm
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid warehouse, name, PIN code and radius are required."
    });
  }

  const warehouse = db.prepare(`
    SELECT id
    FROM warehouses
    WHERE id = ? AND is_active = 1
  `).get(warehouseId);

  if (!warehouse) {
    return res.status(400).json({
      success: false,
      message: "Select an active warehouse."
    });
  }

  const result = db.prepare(`
    INSERT INTO service_areas (
      warehouse_id,
      name,
      pincode,
      radius_km,
      latitude,
      longitude
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    warehouseId,
    name,
    pincode,
    radiusKm,
    req.body?.latitude == null
      ? null
      : Number(req.body.latitude),
    req.body?.longitude == null
      ? null
      : Number(req.body.longitude)
  );

  res.status(201).json({
    success: true,
    id: result.lastInsertRowid,
    message: "Service area created."
  });
});

router.patch("/service-areas/:id/status", (req, res) => {
  if (typeof req.body?.isActive !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "isActive must be boolean."
    });
  }

  const result = db.prepare(`
    UPDATE service_areas
    SET
      is_active = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    req.body.isActive ? 1 : 0,
    Number(req.params.id)
  );

  if (!result.changes) {
    return res.status(404).json({
      success: false,
      message: "Service area not found."
    });
  }

  res.json({
    success: true,
    message: "Service area status updated."
  });
});

/*
 WAREHOUSE INVENTORY
*/

router.get("/warehouses/:id/inventory", (req, res) => {
  const warehouseId = Number(req.params.id);

  const inventory = db.prepare(`
    SELECT
      p.id AS productId,
      p.name,
      p.sku,
      p.stock AS legacyStock,

      COALESCE(wi.quantity, p.stock) AS quantity,

      COALESCE(
        wi.reserved_quantity,
        0
      ) AS reservedQuantity,

      COALESCE(wi.quantity, p.stock)
        - COALESCE(wi.reserved_quantity, 0)
        AS availableQuantity

    FROM products p

    LEFT JOIN warehouse_inventory wi
      ON wi.product_id = p.id
      AND wi.warehouse_id = ?

    ORDER BY p.name
  `).all(warehouseId);

  res.json({
    success: true,
    data: inventory
  });
});

router.put(
  "/warehouses/:id/inventory/:productId",
  (req, res) => {
    const warehouseId = Number(req.params.id);
    const productId = Number(req.params.productId);
    const quantity = req.body?.quantity;

    if (
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      quantity > 100000000
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid non-negative stock quantity."
      });
    }

    try {
      db.transaction(() => {
        const warehouse = db.prepare(`
          SELECT id FROM warehouses WHERE id = ?
        `).get(warehouseId);

        const product = db.prepare(`
          SELECT id FROM products WHERE id = ?
        `).get(productId);

        if (!warehouse || !product) {
          throw new Error("Warehouse or product not found.");
        }

        db.prepare(`
          INSERT INTO warehouse_inventory (
            warehouse_id,
            product_id,
            quantity
          )
          VALUES (?, ?, ?)

          ON CONFLICT(warehouse_id, product_id)
          DO UPDATE SET
            quantity = excluded.quantity,
            updated_at = CURRENT_TIMESTAMP
        `).run(
          warehouseId,
          productId,
          quantity
        );
      })();

      res.json({
        success: true,
        message: "Warehouse inventory saved."
      });

    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }
);

/*
 PAYMENT CONFIGURATION STATUS
*/

router.get("/payments/config", (req, res) => {
  res.json({
    success: true,

    data: {
      codEnabled:
        (process.env.PAYMENT_COD_ENABLED || "true")
          .toLowerCase() === "true",

      onlineEnabled: Boolean(
        process.env.RAZORPAY_KEY_ID &&
        process.env.RAZORPAY_KEY_SECRET
      ),

      onlineProvider:
        process.env.ONLINE_PAYMENT_PROVIDER || "razorpay",

      note:
        "Online payments require verified server-side provider integration."
    }
  });
});

export default router;
