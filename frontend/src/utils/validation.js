// src/utils/validation.js

export const isValidEmail = (email) => {
  // Basic email regex
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const isValidPassword = (password) => {
  // Password must be at least 8 characters long
  return password.length >= 8;
};

export const isEmpty = (value) => {
  return value === null || value === undefined || value === "";
};

// Add more frontend validation functions as needed