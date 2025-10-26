// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { validationResult } from "express-validator";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import xss from "xss-clean";
// REMOVE: import multer from "multer"; // No longer needed directly here
// REMOVE: import { existsSync, mkdirSync } from "fs"; // No longer needed directly here
import connectDB from "./config/db.js";
import { initSocket } from "./socket.js";
// Import global error handler and sendErrorResponse
import errorHandler, { sendErrorResponse } from "./middleware/errorHandler.js"; // Import default and named export

// Import your API routes
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import channelRoutes from "./routes/channelRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import pollRoutes from "./routes/pollRoutes.js";
import whiteboardRoutes from "./routes/whiteboardRoutes.js";
import friendRoutes from "./routes/friendRoutes.js";

// Import specific controllers to pass io instance
import { setFriendControllerIo } from "./controllers/friendController.js";

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Get __dirname equivalent in ES module (needed for static serving of uploads)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Socket.IO and get the io instance
const io = initSocket(server);

// Pass the io instance to controllers that need it for emitting events
setFriendControllerIo(io);

// 1. Helmet: Secure HTTP headers
app.use(helmet());

// 2. CORS: Cross-Origin Resource Sharing
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,            // allow only your frontend
    methods: ["GET","POST","PUT","DELETE","OPTIONS"],
    allowedHeaders: ["Content-Type","Authorization","X-Requested-With","Accept"],
    credentials: true,                // if you use cookies / credentials
    maxAge: 600                       // seconds to cache preflight
  })
);

// 3. Request Logging (Morgan)
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// 4. Body Parsers (must be before xss and routes)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// 5. Data Sanitization against XSS (must be after body parsers and before routes)
app.use(xss());

// 6. Rate Limiting Middleware
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again after 15 minutes",
  headers: true,
});

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message:
    "Too many authentication attempts from this IP, please try again after 10 minutes",
  headers: true,
});

// Apply rate limiters to appropriate routes
app.use("/api", apiLimiter); // Apply to all /api routes by default
app.use("/api/auth", authLimiter); // More strict for auth routes

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads"))); // Adjust based on your project structure. Should point to the same uploads folder.

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/polls", pollRoutes);
app.use("/api/whiteboards", whiteboardRoutes);
app.use("/api/friends", friendRoutes);

// Basic route for testing
app.get("/", (req, res) => {
  res.send("Kord Backend API is running!");
});

// --- Centralized Error Handling Middleware (AFTER routes) ---
// Middleware for express-validator errors
app.use((req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Use sendErrorResponse from errorHandler.js
    return sendErrorResponse(
      res,
      { errors: errors.array() },
      "Validation failed",
      400
    );
  }
  next();
});

// Global error handler for all unhandled errors
app.use(errorHandler); // Use the default exported globalErrorHandler middleware

const PORT = process.env.PORT || 5000;

// Start the HTTP server (which Socket.IO is attached to)
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle unhandled promise rejections (important for async operations)
process.on("unhandledRejection", (err, promise) => {
  console.error(`Unhandled Rejection Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
