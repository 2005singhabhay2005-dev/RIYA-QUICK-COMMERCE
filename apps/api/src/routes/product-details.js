
import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import db from "../database.js";
import { requireAdmin } from "../middleware/auth.js";
import upload from "../middleware/upload.js";

const router = Router();

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(currentDir, "../../uploads/products");

function getProduct(id) {
  return db.prepare(`
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
      c.name AS category,
      c.slug AS categorySlug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.id = ?
  `).get(id);
}

function validId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/* =========================
   PUBLIC: PRODUCT DETAILS
========================= */

router.get("/products/:id/details", (req, res) => {
  try {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID"
      });
    }

    const product = getProduct(id);

    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    const images = db.prepare(`
      SELECT
        id,
        image_url AS imageUrl,
        alt_text AS altText,
        sort_order AS sortOrder,
        is_primary AS isPrimary
      FROM product_images
      WHERE product_id = ?
      ORDER BY is_primary DESC, sort_order ASC, id ASC
    `).all(id);

    const specifications = db.prepare(`
      SELECT
        id,
        specification_name AS name,
        specification_value AS value,
        sort_order AS sortOrder
      FROM product_specifications
      WHERE product_id = ?
      ORDER BY sort_order ASC, id ASC
    `).all(id);

    const reviews = db.prepare(`
      SELECT
        id,
        customer_name AS customerName,
        rating,
        review_title AS title,
        review_text AS reviewText,
        admin_reply AS adminReply,
        created_at AS createdAt
      FROM product_reviews
      WHERE product_id = ? AND status = 'approved'
      ORDER BY created_at DESC
      LIMIT 100
    `).all(id);

    const rating = db.prepare(`
      SELECT
        COUNT(*) AS reviewCount,
        ROUND(AVG(rating), 1) AS averageRating
      FROM product_reviews
      WHERE product_id = ? AND status = 'approved'
    `).get(id);

    const recommendations = db.prepare(`
      SELECT
        p.id,
        p.name,
        p.slug,
        p.price,
        p.original_price AS originalPrice,
        p.image_url AS imageUrl,
        p.stock,
        p.description
      FROM product_recommendations r
      JOIN products p
        ON p.id = r.recommended_product_id
      WHERE r.product_id = ? AND p.is_active = 1
      ORDER BY r.sort_order ASC
      LIMIT 12
    `).all(id);

    // Keep uploaded images and the legacy product image together.
    // Do not add the legacy image again if it is already uploaded.
    const finalImages = [...images];

    if (
      product.imageUrl &&
      !finalImages.some((image) => image.imageUrl === product.imageUrl)
    ) {
      finalImages.push({
        id: null,
        imageUrl: product.imageUrl,
        altText: product.name,
        sortOrder: finalImages.length,
        isPrimary: finalImages.length === 0 ? 1 : 0
      });
    }

    return res.json({
      success: true,
      data: {
        product,
        images: finalImages,
        specifications,
        reviews,
        rating: {
          averageRating: rating.averageRating || 0,
          reviewCount: rating.reviewCount || 0
        },
        recommendations
      }
    });
  } catch (error) {
    console.error("Product details error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load product details"
    });
  }
});

/* =========================
   PUBLIC: SUBMIT REVIEW
========================= */

router.post("/products/:id/reviews", (req, res) => {
  try {
    const id = validId(req.params.id);
    const product = id ? getProduct(id) : null;

    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    const {
      customerName,
      customerEmail,
      rating,
      title,
      reviewText
    } = req.body || {};

    const name = String(customerName || "").trim();
    const review = String(reviewText || "").trim();
    const stars = Number(rating);
    const email = String(customerEmail || "").trim().slice(0, 150);

    if (!name || name.length > 100) {
      throw new Error("Enter a valid customer name");
    }

    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    if (!review || review.length > 3000) {
      throw new Error("Review must be between 1 and 3000 characters");
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address");
    }

    const result = db.prepare(`
      INSERT INTO product_reviews
      (
        product_id,
        customer_name,
        customer_email,
        rating,
        review_title,
        review_text,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      id,
      name,
      email,
      stars,
      String(title || "").trim().slice(0, 150),
      review
    );

    return res.status(201).json({
      success: true,
      message: "Review submitted for approval",
      data: {
        id: Number(result.lastInsertRowid)
      }
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to submit review"
    });
  }
});

/* =========================
   ADMIN: AUTHENTICATION
========================= */

// Every route below /admin requires admin authentication.
router.use("/admin", requireAdmin);

/* =========================
   ADMIN: UPLOAD IMAGES
========================= */

router.post(
  "/admin/product-details/:id/images",
  upload.array("images", 10),
  (req, res) => {
    try {
      const id = validId(req.params.id);

      if (!id || !getProduct(id)) {
        return res.status(404).json({
          success: false,
          message: "Product not found"
        });
      }

      const files = req.files || [];

      if (!files.length) {
        return res.status(400).json({
          success: false,
          message: "Select at least one image"
        });
      }

      const insertImage = db.prepare(`
        INSERT INTO product_images
        (
          product_id,
          image_url,
          alt_text,
          sort_order,
          is_primary
        )
        VALUES (?, ?, ?, ?, ?)
      `);

      const currentCount = db.prepare(`
        SELECT COUNT(*) AS total
        FROM product_images
        WHERE product_id = ?
      `).get(id).total;

      const transaction = db.transaction(() => {
        files.forEach((file, index) => {
          const imageUrl = `/uploads/products/${file.filename}`;

          insertImage.run(
            id,
            imageUrl,
            getProduct(id).name,
            currentCount + index,
            currentCount === 0 && index === 0 ? 1 : 0
          );
        });
      });

      transaction();

      const uploadedImages = db.prepare(`
        SELECT
          id,
          image_url AS imageUrl,
          alt_text AS altText,
          sort_order AS sortOrder,
          is_primary AS isPrimary
        FROM product_images
        WHERE product_id = ?
        ORDER BY is_primary DESC, sort_order ASC, id ASC
      `).all(id);

      return res.status(201).json({
        success: true,
        message: "Product images uploaded",
        data: uploadedImages
      });
    } catch (error) {
      console.error("Image upload error:", error);

      return res.status(400).json({
        success: false,
        message: error.message || "Image upload failed"
      });
    }
  }
);

/* =========================
   ADMIN: SPECIFICATIONS
========================= */

router.put("/admin/product-details/:id/specifications", (req, res) => {
  try {
    const id = validId(req.params.id);
    const items = req.body?.specifications;

    if (!id || !getProduct(id)) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    if (!Array.isArray(items) || items.length > 50) {
      throw new Error("Specifications must be an array of up to 50 items");
    }

    const cleaned = items.map((item) => {
      const name = String(item?.name || "").trim();
      const value = String(item?.value || "").trim();

      if (!name || name.length > 100 || !value || value.length > 500) {
        throw new Error("Each specification needs a valid name and value");
      }

      return { name, value };
    });

    const transaction = db.transaction(() => {
      db.prepare(`
        DELETE FROM product_specifications
        WHERE product_id = ?
      `).run(id);

      const insert = db.prepare(`
        INSERT INTO product_specifications
        (
          product_id,
          specification_name,
          specification_value,
          sort_order
        )
        VALUES (?, ?, ?, ?)
      `);

      cleaned.forEach((item, index) => {
        insert.run(id, item.name, item.value, index);
      });
    });

    transaction();

    return res.json({
      success: true,
      message: "Specifications saved"
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to save specifications"
    });
  }
});

/* =========================
   ADMIN: RECOMMENDATIONS
========================= */

router.put("/admin/product-details/:id/recommendations", (req, res) => {
  try {
    const id = validId(req.params.id);
    const productIds = req.body?.productIds;

    if (!id || !getProduct(id)) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    if (!Array.isArray(productIds) || productIds.length > 12) {
      throw new Error("Choose up to 12 recommended products");
    }

    const ids = [...new Set(productIds.map(Number))];

    if (
      ids.some((value) =>
        !Number.isInteger(value) || value < 1 || value === id
      )
    ) {
      throw new Error("Invalid recommendation product IDs");
    }

    const transaction = db.transaction(() => {
      db.prepare(`
        DELETE FROM product_recommendations
        WHERE product_id = ?
      `).run(id);

      const insert = db.prepare(`
        INSERT INTO product_recommendations
        (
          product_id,
          recommended_product_id,
          sort_order
        )
        VALUES (?, ?, ?)
      `);

      ids.forEach((recommendedId, index) => {
        const recommendedProduct = getProduct(recommendedId);

        if (!recommendedProduct || !recommendedProduct.isActive) {
          throw new Error(`Recommended product ${recommendedId} not found`);
        }

        insert.run(id, recommendedId, index);
      });
    });

    transaction();

    return res.json({
      success: true,
      message: "Recommendations saved"
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to save recommendations"
    });
  }
});

/* =========================
   ADMIN: LIST REVIEWS
========================= */

router.get("/admin/product-details/:id/reviews", (req, res) => {
  try {
    const id = validId(req.params.id);

    if (!id || !getProduct(id)) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    const reviews = db.prepare(`
      SELECT
        id,
        customer_name AS customerName,
        customer_email AS customerEmail,
        rating,
        review_title AS title,
        review_text AS reviewText,
        status,
        admin_reply AS adminReply,
        created_at AS createdAt
      FROM product_reviews
      WHERE product_id = ?
      ORDER BY created_at DESC
    `).all(id);

    return res.json({
      success: true,
      data: reviews
    });
  } catch (error) {
    console.error("Review list error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load reviews"
    });
  }
});

/* =========================
   ADMIN: MODERATE REVIEW
========================= */

router.patch("/admin/product-details/reviews/:reviewId", (req, res) => {
  try {
    const reviewId = validId(req.params.reviewId);
    const status = String(req.body?.status || "");
    const reply = String(req.body?.adminReply || "").trim().slice(0, 2000);

    if (
      !reviewId ||
      !["pending", "approved", "rejected"].includes(status)
    ) {
      throw new Error("Invalid review ID or status");
    }

    const result = db.prepare(`
      UPDATE product_reviews
      SET
        status = ?,
        admin_reply = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, reply, reviewId);

    if (!result.changes) {
      return res.status(404).json({
        success: false,
        message: "Review not found"
      });
    }

    return res.json({
      success: true,
      message: "Review updated"
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to update review"
    });
  }
});

/* =========================
   ADMIN: DELETE IMAGE
========================= */

router.delete("/admin/product-details/images/:imageId", (req, res) => {
  try {
    const imageId = validId(req.params.imageId);

    if (!imageId) {
      return res.status(400).json({
        success: false,
        message: "Invalid image ID"
      });
    }

    const image = db.prepare(`
      SELECT
        id,
        image_url AS imageUrl,
        product_id AS productId
      FROM product_images
      WHERE id = ?
    `).get(imageId);

    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found"
      });
    }

    db.prepare(`
      DELETE FROM product_images
      WHERE id = ?
    `).run(imageId);

    const filename = path.basename(image.imageUrl);
    const filePath = path.resolve(uploadDir, filename);

    if (
      image.imageUrl.startsWith("/uploads/products/") &&
      filePath.startsWith(uploadDir + path.sep) &&
      fs.existsSync(filePath)
    ) {
      fs.unlinkSync(filePath);
    }

    const remaining = db.prepare(`
      SELECT id
      FROM product_images
      WHERE product_id = ?
      ORDER BY sort_order ASC, id ASC
    `).all(image.productId);

    if (remaining.length) {
      db.prepare(`
        UPDATE product_images
        SET is_primary = 0
        WHERE product_id = ?
      `).run(image.productId);

      db.prepare(`
        UPDATE product_images
        SET is_primary = 1
        WHERE id = ?
      `).run(remaining[0].id);
    }

    return res.json({
      success: true,
      message: "Image deleted"
    });
  } catch (error) {
    console.error("Image deletion error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete image"
    });
  }
});

export default router;
