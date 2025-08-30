import { create } from "zustand";
import contactService from "@/services/contactService";

export const useContactsStore = create((set) => ({
  dmContacts: [], // Contacts for direct messages
  allUsers: [], // All registered users (for search/discovery)
  searchResults: [], // Results from user search

  setDmContacts: (contacts) => set({ dmContacts: contacts }),
  setAllUsers: (users) => set({ allUsers: users }),
  setSearchResults: (results) => set({ searchResults: results }),

  fetchDmContacts: async () => {
    try {
      const data = await contactService.getDmContacts();
      if (data.success) {
        set({ dmContacts: data.data.contacts });
      }
    } catch (error) {
      console.error("Failed to fetch DM contacts:", error);
    }
  },

  searchUsers: async (query) => {
    try {
      const results = await contactService.searchContacts(query);
      set({ searchResults: results }); // ✅ directly set array
    } catch (error) {
      console.error("Failed to search users:", error);
      set({ searchResults: [] });
    }
  },

  fetchAllUsers: async () => {
    try {
      const data = await contactService.getAllContacts();
      if (data.success) {
        set({ allUsers: data.data.users });
      }
    } catch (error) {
      console.error("Failed to fetch all users:", error);
    }
  },
}));
