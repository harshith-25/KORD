import axios from "axios";
import { HOST } from "./ApiRoutes";
import { useAuthStore } from "@/store/authStore"; // Make sure this path is correct

const api = axios.create({
  baseURL: HOST, // This should already be correct from previous steps
  withCredentials: true,
});

// --- Request Interceptor ---
// This interceptor will run BEFORE every request is sent.
// It checks if a token exists and attaches it to the Authorization header.
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token; // <--- SET BREAKPOINT HERE (Line X)
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- Response Interceptor (Optional but Recommended) ---
// This interceptor will run AFTER a response is received.
// It can handle global error conditions, like 401 Unauthorized.
// api.interceptors.response.use(
//   (response) => response, // If response is successful, just pass it through
//   async (error) => {
//     // Check if the error is a 401 Unauthorized response
//     // And ensure it's not an error from the login or refresh token routes themselves (to prevent infinite loops)
//     if (
//       error.response?.status === 401 &&
//       error.config.url !== "/api/auth/login" &&
//       error.config.url !== "/api/auth/refresh-token"
//     ) {
//       console.warn("Unauthorized response (401). Logging out...");
//       // Access the logout function directly from the store's state
//       useAuthStore.getState().logout();
//       // Optionally, redirect the user to the login page
//       // This requires react-router-dom's navigate function if you're using it,
//       // or a simple window.location.href if outside React context.
//       // For now, just logging out is sufficient.
//     }
//     return Promise.reject(error); // Re-throw the error so it can be caught by the calling function
//   }
// );

export default api;
