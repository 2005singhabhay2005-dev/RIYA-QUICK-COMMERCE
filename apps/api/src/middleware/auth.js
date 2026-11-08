
import jwt from "jsonwebtoken";
import db from "../database.js";

export function requireAdmin(req, res, next) {
  try {
    // 1. Check authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    // 2. Extract token
    const token = authHeader.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing"
      });
    }

    // 3. Check JWT secret
    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
      return res.status(500).json({
        success: false,
        message: "Server authentication is not configured"
      });
    }

    // 4. Verify token
    const decoded = jwt.verify(token, secret, {
      issuer: "riya-quick-commerce",
      algorithms: ["HS256"]
    });

    // 5. Validate admin ID from JWT subject
    const adminId = Number(decoded.sub);

    if (
      !Number.isSafeInteger(adminId) ||
      adminId < 1 ||
      decoded.role !== "admin"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token"
      });
    }

    // 6. Check admin account in database
    const admin = db.prepare(`
      SELECT
        id,
        email,
        role,
        is_active
      FROM admin_users
      WHERE id = ?
        AND is_active = 1
    `).get(adminId);

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Admin account is inactive or unavailable"
      });
    }

    // 7. Attach authenticated admin
    req.admin = {
      id: admin.id,
      email: admin.email,
      role: admin.role
    };

    return next();

  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Authentication token has expired"
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token"
      });
    }

    console.error("Admin authentication error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Authentication failed"
    });
  }
}
