import { create } from "zustand";
import contactService from "@/services/contactService";

export const useContactsStore = create((set, get) => ({
  // State
  dmContacts: [], // Contacts for direct messages
  allUsers: [], // All registered users (for search/discovery)
  searchResults: [], // Results from user search
  selectedConversation: null, // Currently selected conversation
  isCreatingConversation: false, // Loading state for conversation creation
  isSearching: false, // Loading state for search
  error: null, // Error state

  // Setters
  setDmContacts: (contacts) => set({ dmContacts: contacts }),
  setAllUsers: (users) => set({ allUsers: users }),
  setSearchResults: (results) => set({ searchResults: results }),
  setSelectedConversation: (conversation) =>
    set({ selectedConversation: conversation }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  // Fetch DM contacts
  fetchDmContacts: async () => {
    try {
      const data = await contactService.getDmContacts();
      if (data.success) {
        set({ dmContacts: data.data.contacts, error: null });
      }
    } catch (error) {
      console.error("Failed to fetch DM contacts:", error);
      set({ error: "Failed to fetch contacts" });
    }
  },

  // Search users with debounce handling
  searchUsers: async (query) => {
    if (!query || query.trim().length === 0) {
      set({ searchResults: [], isSearching: false });
      return;
    }

    set({ isSearching: true, error: null });

    try {
      const results = await contactService.searchContacts(query);
      set({
        searchResults: Array.isArray(results) ? results : [],
        isSearching: false,
      });
    } catch (error) {
      console.error("Failed to search users:", error);
      set({
        searchResults: [],
        isSearching: false,
        error: "Failed to search users",
      });
    }
  },

  // Fetch all users
  fetchAllUsers: async () => {
    try {
      const data = await contactService.getAllContacts();
      if (data.success) {
        set({ allUsers: data.data.users, error: null });
      }
    } catch (error) {
      console.error("Failed to fetch all users:", error);
      set({ error: "Failed to fetch users" });
    }
  },

  // This is now deprecated - use conversationStore.createDirectConversation instead
  // Kept for backward compatibility
  createDirectConversation: async (userId) => {
    console.warn(
      "contactsStore.createDirectConversation is deprecated. Use conversationStore.createDirectConversation instead."
    );

    set({ isCreatingConversation: true, error: null });

    try {
      const conversation = await contactService.createDirectConversation(
        userId
      );

      // Validate conversation response
      if (!conversation || !conversation.conversationId) {
        throw new Error("Invalid conversation response");
      }

      // Check if this conversation already exists in dmContacts
      const existingContactIndex = get().dmContacts.findIndex(
        (contact) => contact.conversationId === conversation.conversationId
      );

      // If it's a new conversation, add it to dmContacts
      if (existingContactIndex === -1) {
        set((state) => ({
          dmContacts: [conversation, ...state.dmContacts],
        }));
      } else {
        // Update existing conversation
        set((state) => {
          const updatedContacts = [...state.dmContacts];
          updatedContacts[existingContactIndex] = conversation;
          return { dmContacts: updatedContacts };
        });
      }

      set({
        selectedConversation: conversation,
        isCreatingConversation: false,
        error: null,
      });

      return conversation;
    } catch (error) {
      console.error("Failed to create direct conversation:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to create conversation";
      set({
        isCreatingConversation: false,
        error: errorMessage,
      });
      throw error;
    }
  },

  // Clear search results
  clearSearchResults: () => set({ searchResults: [] }),

  // Reset store state
  resetStore: () =>
    set({
      dmContacts: [],
      allUsers: [],
      searchResults: [],
      selectedConversation: null,
      isCreatingConversation: false,
      isSearching: false,
      error: null,
    }),
}));