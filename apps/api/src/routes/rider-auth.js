import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../database.js";
import { requireRider } from "../middleware/rider-auth.js";

const router = Router();

function createToken(rider) {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET is not configured correctly.");
  }

  return jwt.sign(
    { role: "rider" },
    secret,
    {
      subject: String(rider.id),
      issuer: "riya-quick-commerce",
      expiresIn: "8h",
      algorithm: "HS256"
    }
  );
}

router.post("/login", async (req, res) => {
  try {
    const identifier = String(req.body?.identifier || "")
      .trim()
      .toLowerCase();

    const password = String(req.body?.password || "");

    if (!identifier || !password || password.length > 72) {
      return res.status(400).json({
        success: false,
        message: "Valid phone/email and password are required"
      });
    }

    const rider = db.prepare(`
      SELECT id, name, phone, email, password_hash, is_active
      FROM riders
      WHERE (LOWER(phone) = ? OR LOWER(email) = ?)
      LIMIT 1
    `).get(identifier, identifier);

    if (
      !rider ||
      rider.is_active !== 1 ||
      !(await bcrypt.compare(password, rider.password_hash))
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid login credentials"
      });
    }

    const token = createToken(rider);

    return res.json({
      success: true,
      message: "Rider login successful",
      token,
      rider: {
        id: rider.id,
        name: rider.name,
        phone: rider.phone,
        email: rider.email
      }
    });
  } catch (error) {
    console.error("Rider login error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to login"
    });
  }
});

router.get("/me", requireRider, (req, res) => {
  return res.json({
    success: true,
    rider: req.rider
  });
});

export default router;
