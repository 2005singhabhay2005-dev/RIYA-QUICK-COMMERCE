import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";

import db from "../database.js";
import { sendCustomerEmailOtp } from "../services/email.js";

export function requireCustomer(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Customer login required"
      });
    }

    const token = header.slice(7).trim();
    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
      return res.status(500).json({
        success: false,
        message: "Authentication is not configured"
      });
    }

    const decoded = jwt.verify(token, secret, {
      issuer: "riya-quick-commerce",
      algorithms: ["HS256"]
    });

    const customerId = Number(decoded.sub);

    if (
      !Number.isSafeInteger(customerId) ||
      customerId < 1 ||
      decoded.role !== "customer"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid customer token"
      });
    }

    const customer = db.prepare(`
      SELECT
        id,
        name,
        email,
        phone,
        is_active,
        email_verified,
        session_version
      FROM customers
      WHERE id = ? AND is_active = 1
    `).get(customerId);

    if (!customer) {
      return res.status(401).json({
        success: false,
        message: "Customer account is inactive or unavailable"
      });
    }

    if (
      Number(customer.email_verified) !== 1
    ) {
      return res.status(401).json({
        success: false,
        message: "Customer email is not verified"
      });
    }

    if (
      !Number.isSafeInteger(Number(customer.session_version)) ||
      Number(decoded.sessionVersion) !== Number(customer.session_version)
    ) {
      return res.status(401).json({
        success: false,
        message: "Customer session has been revoked"
      });
    }

    req.customer = customer;
    next();
  } catch (error) {
    if (
      error.name === "TokenExpiredError" ||
      error.name === "JsonWebTokenError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired customer token"
      });
    }

    console.error("Customer authentication error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Customer authentication failed"
    });
  }
}
