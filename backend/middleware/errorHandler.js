const errorHandler = (err, req, res, next) => {
  console.error(err); // Log the error for debugging purposes

  if (err.name === "ValidationError") {
    return res.status(400).json({ message: err.message, errors: err.errors });
  }

  if (err.name === "CastError" && err.kind === "ObjectId") {
    return res.status(400).json({ message: "Invalid ID format." });
  }

  // Handle specific errors, e.g., Mongoose duplicate key error
  if (err.code === 11000) {
    return res
      .status(409)
      .json({ message: "Duplicate key error.", fields: err.keyValue });
  }

  // Default to 500 Internal Server Error
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({ message });
};

// utils/errorHandlers.js

// Centralized error response helper for controllers
export const sendErrorResponse = (
  res,
  error,
  message = "Internal Server Error",
  statusCode = 500
) => {
  // Log the full error for debugging purposes on the server side
  console.error(`[Error] ${message}:`, error);

  // Send a more user-friendly error message to the client
  res.status(statusCode).json({
    success: false,
    message: message,
    // In production, avoid sending detailed error messages to the client
    // For development, you might include:
    // error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    // stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  });
};

export const BadRequestError = () => {} 
export const ConflictError = () => {} 
export const ForbiddenError = () => {} 
export const NotFoundError = () => {} 
export const UnauthorizedError = () => {} 

export default errorHandler;
