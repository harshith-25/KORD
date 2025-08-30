import jwt from "jsonwebtoken";
import User from "../models/UserModel.js"; // Correct path to your User model
import { promisify } from "util";
import { UnauthorizedError, ForbiddenError } from "./errorHandler.js"; // This import will now work!

// Middleware for Express routes (used by most API endpoints)

export const verifyToken = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res
        .status(401)
        .json({ message: "Not authorized, no token provided." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET.trim());
    const userId = decoded.id;

    if (!userId) {
      return res.status(401).json({ message: "Invalid token payload." });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res
        .status(401)
        .json({ message: "Not authorized, user not found." });
    }

    req.userId = userId;
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Not authorized, token failed." });
  }
};

// Middleware specifically for Socket.IO authentication
// This function needs to be explicitly exported
export const verifyTokenSocket = async (token) => {
  try {
    // Assuming JWT payload has 'id', not '_id'
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      throw new Error("User not found.");
    }
    return user;
  } catch (error) {
    console.error("Socket authentication error:", error);
    throw new Error("Invalid token.");
  }
};

// Middleware to check if user is admin (for admin routes)
export const authorizeAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).send("Not authorized as an admin.");
  }
};

export const protect = async (req, res, next) => {
  try {
    let token;

    // 1) Get token from header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      // This will now correctly use the imported UnauthorizedError
      return next(
        new UnauthorizedError(
          "You are not logged in! Please log in to get access."
        )
      );
    }

    // 2) Verify token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 3) Check if user still exists
    // Assuming JWT payload has 'id', not '_id'
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      // This will now correctly use the imported UnauthorizedError
      return next(
        new UnauthorizedError(
          "The user belonging to this token no longer exists."
        )
      );
    }

    // 4) Grant access to protected route
    req.user = currentUser; // Attach user to request object
    next();
  } catch (error) {
    // Pass any JWT verification errors to global error handler (which also handles JsonWebTokenError and TokenExpiredError)
    next(error);
  }
};
