import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useNavigate } from "react-router-dom";

export const useAuth = () => {
  const { isAuthenticated, isLoading, initializeAuth, user, logout } =
    useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Initialize auth state when the app loads
    initializeAuth();
  }, [initializeAuth]); // Dependency array to prevent infinite loop

  return { isAuthenticated, isLoading, user, logout };
};