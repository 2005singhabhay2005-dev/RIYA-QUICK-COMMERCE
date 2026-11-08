import { Router } from "express";
import db from "../database.js";
import { requireRider } from "../middleware/rider-auth.js";

const router = Router();

router.use(requireRider);

function ensurePresence(riderId) {
  db.prepare(`
    INSERT OR IGNORE INTO rider_presence (rider_id, is_online)
    VALUES (?, 0)
  `).run(riderId);
}

// GET /api/rider/gps/status
router.get("/status", (req, res) => {
  try {
    ensurePresence(req.rider.id);

    const presence = db.prepare(`
      SELECT is_online, last_seen_at, updated_at
      FROM rider_presence
      WHERE rider_id = ?
    `).get(req.rider.id);

    const location = db.prepare(`
      SELECT latitude, longitude, accuracy, heading,
             speed, recorded_at
      FROM rider_locations
      WHERE rider_id = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(req.rider.id);

    return res.json({
      success: true,
      data: {
        presence,
        location: location || null
      }
    });
  } catch (error) {
    console.error("Rider GPS status error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load GPS status"
    });
  }
});

// PATCH /api/rider/gps/presence
router.patch("/presence", (req, res) => {
  try {
    const online = req.body?.online;

    if (typeof online !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "online must be true or false"
      });
    }

    ensurePresence(req.rider.id);

    db.prepare(`
      UPDATE rider_presence
      SET is_online = ?,
          last_seen_at = CASE
            WHEN ? = 1 THEN CURRENT_TIMESTAMP
            ELSE last_seen_at
          END,
          updated_at = CURRENT_TIMESTAMP
      WHERE rider_id = ?
    `).run(online ? 1 : 0, online ? 1 : 0, req.rider.id);

    return res.json({
      success: true,
      message: online ? "Rider is now online" : "Rider is now offline",
      data: {
        online
      }
    });
  } catch (error) {
    console.error("Rider presence update error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update rider availability"
    });
  }
});

// POST /api/rider/gps/location
router.post("/location", (req, res) => {
  try {
    const {
      latitude,
      longitude,
      accuracy,
      heading,
      speed
    } = req.body || {};

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 || lat > 90 ||
      lng < -180 || lng > 180
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid latitude and longitude are required"
      });
    }

    const optionalNumber = (value, min, max) => {
      if (value === null || value === undefined || value === "") {
        return null;
      }

      const number = Number(value);

      if (
        !Number.isFinite(number) ||
        number < min ||
        number > max
      ) {
        return undefined;
      }

      return number;
    };

    const safeAccuracy = optionalNumber(accuracy, 0, 100000);
    const safeHeading = optionalNumber(heading, 0, 360);
    const safeSpeed = optionalNumber(speed, 0, 1000);

    if (
      safeAccuracy === undefined ||
      safeHeading === undefined ||
      safeSpeed === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid GPS accuracy, heading or speed"
      });
    }

    ensurePresence(req.rider.id);

    const presence = db.prepare(`
      SELECT is_online
      FROM rider_presence
      WHERE rider_id = ?
    `).get(req.rider.id);

    if (!presence?.is_online) {
      return res.status(409).json({
        success: false,
        message: "Go online before sharing GPS location"
      });
    }

    const activeDelivery = db.prepare(`
      SELECT id
      FROM orders
      WHERE assigned_rider_id = ?
        AND status = 'Out for Delivery'
      LIMIT 1
    `).get(req.rider.id);

    if (!activeDelivery) {
      return res.status(409).json({
        success: false,
        message: "GPS sharing is available only during an active delivery"
      });
    }

    // Basic server-side throttling: one stored point per 3 seconds.
    const latest = db.prepare(`
      SELECT created_at
      FROM rider_locations
      WHERE rider_id = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(req.rider.id);

    if (latest) {
      const lastTime = new Date(`${latest.created_at.replace(" ", "T")}Z`).getTime();

      if (
        Number.isFinite(lastTime) &&
        Date.now() - lastTime < 3000
      ) {
        return res.status(429).json({
          success: false,
          message: "GPS update received too recently"
        });
      }
    }

    db.prepare(`
      INSERT INTO rider_locations (
        rider_id,
        latitude,
        longitude,
        accuracy,
        heading,
        speed
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.rider.id,
      lat,
      lng,
      safeAccuracy,
      safeHeading,
      safeSpeed
    );

    db.prepare(`
      UPDATE rider_presence
      SET last_seen_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE rider_id = ?
    `).run(req.rider.id);

    // Keep the latest 500 points per rider.
    db.prepare(`
      DELETE FROM rider_locations
      WHERE rider_id = ?
        AND id NOT IN (
          SELECT id
          FROM rider_locations
          WHERE rider_id = ?
          ORDER BY id DESC
          LIMIT 500
        )
    `).run(req.rider.id, req.rider.id);

    return res.json({
      success: true,
      message: "GPS location updated",
      data: {
        latitude: lat,
        longitude: lng,
        recorded_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Rider GPS location error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update GPS location"
    });
  }
});

export default router;