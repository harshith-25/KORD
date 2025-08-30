// src/store/themeStore.js
import { create } from "zustand";

export const useThemeStore = create((set) => ({
  theme: localStorage.getItem("theme") || "light", // Default to light, or saved preference

  setTheme: (newTheme) => {
    set({ theme: newTheme });
    localStorage.setItem("theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  },

  toggleTheme: () => {
    set((state) => {
      const newTheme = state.theme === "light" ? "dark" : "light";
      localStorage.setItem("theme", newTheme);
      if (newTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return { theme: newTheme };
    });
  },

  initializeTheme: () => {
    const savedTheme = localStorage.getItem("theme") || "light";
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    set({ theme: savedTheme });
  },
}));

useThemeStore.getState().initializeTheme();