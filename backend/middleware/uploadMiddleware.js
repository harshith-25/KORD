// src/middleware/uploadMiddleware.js
import multer from "multer";
import path from "path";
import { existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Adjust path to point to your main 'uploads' folder in the project root
// Assuming src/middleware is inside 'src', so '../' takes it to 'src', then '../' to project root
const uploadsDir = path.join(__dirname, "..", "..", "uploads");

if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

// Configure Multer upload middleware
// CORRECTED: Declare 'upload' with 'const' and use 'export const' for a named export
export const upload = multer({
  // <--- THIS IS THE FIX: 'export const'
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file size limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx|mp4|mov|mp3|wav|txt/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(
      new Error(
        "File upload only supports the following filetypes: " + filetypes.source
      )
    );
  },
});