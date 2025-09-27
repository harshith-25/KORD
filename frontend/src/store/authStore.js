import { create } from "zustand";
import api from "@/utils/axiosInstance";

const safeGetLocalStorageItem = (key) => {
  const item = localStorage.getItem(key);

  // Handle null, undefined string, and "null" string from localStorage
  if (item === null || item === "undefined" || item === "null") {
    return null;
  }
  try {
    if (key === "token") {
      return item; // Token is stored as a raw string
    }
    // For 'user', try to parse. If it's a malformed JSON or just '{}',
    // ensure it's still treated as an object or null if parsing yields null/undefined.
    const parsedItem = JSON.parse(item);
    if (parsedItem === null || typeof parsedItem === "undefined") {
      return null; // Ensure we don't return JS undefined if parsing "undefined"
    }
    return parsedItem; // Returns the parsed object for 'user'
  } catch (e) {
    console.error(`Error parsing localStorage item "${key}":`, e);
    localStorage.removeItem(key); // Clear corrupted item
    return null;
  }
};

export const useAuthStore = create((set) => ({
  // Initialize state using the new, consistent keys
  user: safeGetLocalStorageItem("user"), // Will store the user object
  token: safeGetLocalStorageItem("token"), // Will store the JWT token string
  isAuthenticated: !!safeGetLocalStorageItem("token"), // Check for token existence

  loading: false,
  error: null,

  setLoading: (isLoading) => set({ loading: isLoading }),
  setError: (errorMessage) => set({ error: errorMessage }),

  initializeAuth: () => {
    const token = safeGetLocalStorageItem("token");
    const user = safeGetLocalStorageItem("user"); // This will now correctly be null if not found
    set({ token, user, isAuthenticated: !!token });
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post("/api/auth/login", { email, password });
      const { token, user } = response.data; // User will be null or an object here from backend
      console.log(user);

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user)); // If user is null, this stores "null"

      set({
        user, // This `user` comes directly from the response.data destructuring
        token,
        isAuthenticated: true,
        loading: false,
        error: null,
      });
      return user;
    } catch (err) {
      console.error(
        "Login failed:",
        err.response ? err.response.data : err.message
      );
      const errorMessage =
        err.response?.data?.message ||
        "Login failed. Please check your credentials.";
      set({ loading: false, error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  register: async (firstName, lastName, email, password) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post("/api/auth/register", {
        firstName,
        lastName,
        email,
        password,
      });
      const { token, user } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      set({
        user,
        token,
        isAuthenticated: true,
        loading: false,
        error: null,
      });
      return user;
    } catch (err) {
      console.error(
        "Registration failed:",
        err.response ? err.response.data : err.message
      );
      const errorMessage =
        err.response?.data?.message || "Registration failed. Please try again.";
      set({ loading: false, error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    set({ user: null, token: null, isAuthenticated: false, error: null });
  },
}));
