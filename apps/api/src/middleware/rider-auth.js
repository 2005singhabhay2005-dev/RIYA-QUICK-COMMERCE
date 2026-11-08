import jwt from "jsonwebtoken";
import db from "../database.js";

export function requireRider(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Rider authentication required"
      });
    }

    const token = authHeader.slice(7).trim();
    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
      return res.status(500).json({
        success: false,
        message: "Server authentication is not configured"
      });
    }

    const decoded = jwt.verify(token, secret, {
      issuer: "riya-quick-commerce",
      algorithms: ["HS256"]
    });

    const riderId = Number(decoded.sub);

    if (
      !Number.isSafeInteger(riderId) ||
      riderId < 1 ||
      decoded.role !== "rider"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid rider token"
      });
    }

    const rider = db.prepare(`
      SELECT id, name, phone, email, is_active
      FROM riders
      WHERE id = ? AND is_active = 1
    `).get(riderId);

    if (!rider) {
      return res.status(401).json({
        success: false,
        message: "Rider account is inactive or unavailable"
      });
    }

    req.rider = rider;
    next();
  } catch (error) {
    if (
      error.name === "TokenExpiredError" ||
      error.name === "JsonWebTokenError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired rider token"
      });
    }

    console.error("Rider authentication error:", error);

    return res.status(500).json({
      success: false,
      message: "Rider authentication failed"
    });
  }
}
