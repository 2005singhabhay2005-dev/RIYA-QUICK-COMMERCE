import { Router } from "express";
import db from "../database.js";
import { requireAdmin } from "../middleware/auth.js";
import bannerUpload from "../middleware/banner-upload.js";

const router = Router();

function cleanText(value, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function bannerPayload(body = {}) {
  const title = cleanText(body.title, 160);
  if (!title) throw new Error("Banner title is required.");

  return {
    title,
    subtitle: cleanText(body.subtitle, 500),
    imageUrl: cleanText(body.imageUrl, 1000),
    bannerType: body.bannerType === "promo" ? "promo" : "hero",
    ctaText: cleanText(body.ctaText, 80) || "Explore now",
    ctaLink: cleanText(body.ctaLink, 500) || "#products",
    sortOrder: Number.isInteger(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    isActive: body.isActive === false || body.isActive === 0 ? 0 : 1,
    isPublished: body.isPublished === true || body.isPublished === 1 ? 1 : 0
  };
}

function mapBanner(row) {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    imageUrl: row.image_url,
    bannerType: row.banner_type,
    ctaText: row.cta_text,
    ctaLink: row.cta_link,
    sortOrder: row.sort_order,
    isActive: Boolean(row.is_active),
    isPublished: Boolean(row.is_published),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Public: published and active banners only.
router.get("/", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM homepage_banners
      WHERE is_active = 1 AND is_published = 1
      ORDER BY CASE banner_type WHEN 'hero' THEN 0 ELSE 1 END,
               sort_order ASC, id DESC
    `).all();

    res.json({ success: true, data: rows.map(mapBanner) });
  } catch (error) {
    console.error("Homepage CMS public error:", error);
    res.status(500).json({ success: false, message: "Unable to load homepage banners." });
  }
});

// Admin routes require authentication.
router.use(requireAdmin);
// Admin: upload a homepage banner image.
router.post("/admin/upload", bannerUpload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Please select an image to upload."
    });
  }

  res.status(201).json({
    success: true,
    data: {
      imageUrl: `/uploads/banners/${req.file.filename}`,
      filename: req.file.filename,
      size: req.file.size
    }
  });
});

router.get("/admin/banners", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM homepage_banners
      ORDER BY banner_type ASC, sort_order ASC, id DESC
    `).all();

    res.json({ success: true, data: rows.map(mapBanner) });
  } catch (error) {
    console.error("Homepage CMS admin error:", error);
    res.status(500).json({ success: false, message: "Unable to load banners." });
  }
});

router.post("/admin/banners", (req, res) => {
  try {
    const item = bannerPayload(req.body);
    const result = db.prepare(`
      INSERT INTO homepage_banners
        (title, subtitle, image_url, banner_type, cta_text, cta_link,
         sort_order, is_active, is_published)
      VALUES
        (@title, @subtitle, @imageUrl, @bannerType, @ctaText, @ctaLink,
         @sortOrder, @isActive, @isPublished)
    `).run(item);

    const row = db.prepare("SELECT * FROM homepage_banners WHERE id = ?")
      .get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: mapBanner(row) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || "Unable to create banner." });
  }
});

router.put("/admin/banners/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ success: false, message: "Invalid banner ID." });
    }

    const item = bannerPayload(req.body);
    const result = db.prepare(`
      UPDATE homepage_banners
      SET title = @title,
          subtitle = @subtitle,
          image_url = @imageUrl,
          banner_type = @bannerType,
          cta_text = @ctaText,
          cta_link = @ctaLink,
          sort_order = @sortOrder,
          is_active = @isActive,
          is_published = @isPublished,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({ ...item, id });

    if (!result.changes) {
      return res.status(404).json({ success: false, message: "Banner not found." });
    }

    const row = db.prepare("SELECT * FROM homepage_banners WHERE id = ?").get(id);
    res.json({ success: true, data: mapBanner(row) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || "Unable to update banner." });
  }
});

router.delete("/admin/banners/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ success: false, message: "Invalid banner ID." });
  }

  const result = db.prepare("DELETE FROM homepage_banners WHERE id = ?").run(id);
  if (!result.changes) {
    return res.status(404).json({ success: false, message: "Banner not found." });
  }

  res.json({ success: true, message: "Banner deleted." });
});

export default router;
