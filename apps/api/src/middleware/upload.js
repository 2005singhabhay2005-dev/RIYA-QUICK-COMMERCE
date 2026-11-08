
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(currentDir, "../../uploads/products");

fs.mkdirSync(uploadDir, { recursive: true });

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

const allowedExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif"
]);

const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, uploadDir);
  },

  filename(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    const filename = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    callback(null, filename);
  }
});

function fileFilter(req, file, callback) {
  const extension = path.extname(file.originalname).toLowerCase();

  if (
    !allowedMimeTypes.has(file.mimetype) ||
    !allowedExtensions.has(extension)
  ) {
    return callback(
      new Error("Only JPG, PNG, WEBP and GIF images are allowed.")
    );
  }

  callback(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10
  }
});

export default upload;
