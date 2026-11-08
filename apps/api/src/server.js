
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import db from "./database.js";
import adminRoutes from "./routes/admin.js";
import ordersRoutes from "./routes/orders.js";
import productDetailsRoutes from "./routes/product-details.js";
import customerAuthRoutes from "./routes/customer-auth.js";
import customerOrderRoutes from "./routes/customer-orders.js";
import customerProfileRoutes from "./routes/customer-profile.js";
import ridersAdminRoutes from "./routes/riders-admin.js";
import riderAssignmentRoutes from "./routes/rider-assignment.js";
import riderAuthRoutes from "./routes/rider-auth.js";
import riderRoutes from "./routes/rider.js";

import path from "node:path";
import { fileURLToPath } from "node:url";
import riderLiveAdminRoutes from "./routes/rider-live-admin.js";
import riderGpsRoutes from "./routes/rider-gps.js";
import commerceFoundationRoutes from "./routes/commerce-foundation.js";
import homepageCmsRoutes from './routes/homepage-cms.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 5000;

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5175",
  ...(process.env.STOREFRONT_URL ? [process.env.STOREFRONT_URL] : []),
  ...(process.env.ADMIN_URL ? [process.env.ADMIN_URL] : [])
]);

// CORS
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origin not allowed by CORS"));
  }
}));

// Request body
app.use(express.json({ limit: "1mb" }));

// Public product image uploads
app.use(
  "/uploads",
  express.static(path.resolve(__dirname, "../uploads"))
);

// Health check
app.get("/api/health", (req, res) => {
  try {
    const result = db.prepare("SELECT 1 AS database_status").get();

    res.json({
      success: true,
      message: "Riya Quick Commerce API is running",
      database: result.database_status === 1 ? "connected" : "disconnected",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Health check error:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed"
    });
  }
});

// Public categories
app.get("/api/categories", (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT
        c.id,
        c.name,
        c.slug,
        c.description,
        COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN products p
        ON p.category_id = c.id AND p.is_active = 1
      GROUP BY c.id
      ORDER BY c.name
    `).all();

    res.json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    console.error("Categories error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch categories"
    });
  }
});

// Public products
app.get("/api/products", (req, res) => {
  try {
    const search = String(req.query.search || "").trim().slice(0, 100);
    const category = String(req.query.category || "").trim().slice(0, 80);

    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20)
    );

    const conditions = ["p.is_active = 1"];
    const params = [];

    if (search) {
      conditions.push("(p.name LIKE ? OR p.description LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      conditions.push("c.slug = ?");
      params.push(category.toLowerCase());
    }

    const where = conditions.join(" AND ");

    const countResult = db.prepare(`
      SELECT COUNT(*) AS total
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE ${where}
    `).get(...params);

    const products = db.prepare(`
      SELECT
        p.id,
        p.name,
        p.slug,
        p.description,
        p.price,
        p.original_price AS originalPrice,
        p.stock,
        p.image_url AS imageUrl,
        p.sku,
        c.name AS category,
        c.slug AS categorySlug
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE ${where}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, (page - 1) * limit);

    res.json({
      success: true,
      count: products.length,
      total: countResult.total,
      page,
      limit,
      data: products
    });
  } catch (error) {
    console.error("Products error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch products"
    });
  }
});

// One public product
app.get("/api/products/:id", (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID"
      });
    }

    const product = db.prepare(`
      SELECT
        p.id,
        p.name,
        p.slug,
        p.description,
        p.price,
        p.original_price AS originalPrice,
        p.stock,
        p.image_url AS imageUrl,
        p.sku,
        c.name AS category,
        c.slug AS categorySlug
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = ? AND p.is_active = 1
    `).get(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error("Single product error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch product"
    });
  }
});

// Existing Admin API
app.use("/api/admin", adminRoutes);
app.use("/api/admin/riders", ridersAdminRoutes);
app.use("/api/rider/auth", riderAuthRoutes);
app.use("/api/rider", riderRoutes);
app.use("/api/rider/gps", riderGpsRoutes);
app.use("/api/admin/rider-live", riderLiveAdminRoutes);
app.use("/api/customer/auth", customerAuthRoutes);
app.use("/api/customer/orders", customerOrderRoutes);
app.use("/api/customer/profile", customerProfileRoutes);
app.use("/api/admin/orders", riderAssignmentRoutes);
app.use("/api/admin/orders", ordersRoutes);

// Commerce Foundation API
app.use("/api/commerce", commerceFoundationRoutes);
app.use('/api/homepage-cms', homepageCmsRoutes);

// Product Details API
// Public:
// GET  /api/products/:id/details
// POST /api/products/:id/reviews
//
// Admin:
// /api/admin/product-details/...
app.use("/api", productDetailsRoutes);

// API information
app.get("/api", (req, res) => {
  res.json({
    name: "Riya Quick Commerce API",
    version: "1.2.0",
    endpoints: [
      "GET /api/health",
      "GET /api/categories",
      "GET /api/products",
      "GET /api/products/:id",
      "GET /api/products/:id/details",
      "POST /api/products/:id/reviews",
      "POST /api/admin/login",
      "GET /api/admin/dashboard",
      "GET /api/admin/products",
      "POST /api/admin/products",
      "PUT /api/admin/products/:id",
      "PATCH /api/admin/products/:id/status",
      "PATCH /api/admin/products/:id/stock",
      "GET /api/admin/categories",
      "POST /api/admin/categories",
      "PUT /api/admin/categories/:id",
      "GET /api/admin/inventory/logs",
      "POST /api/admin/product-details/:id/images",
      "PUT /api/admin/product-details/:id/specifications",
      "PUT /api/admin/product-details/:id/recommendations",
      "GET /api/admin/product-details/:id/reviews"
    ]
  });
});

// Not found
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found"
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error(error);

  if (error.message === "Origin not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "Origin not allowed"
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
});

// Start server
app.listen(PORT, () => {
  console.log("-------------------------------------");
  console.log(" Riya Quick Commerce API");
  console.log(` http://localhost:${PORT}`);
  console.log(` http://localhost:${PORT}/api/health`);
  console.log("-------------------------------------");
});





