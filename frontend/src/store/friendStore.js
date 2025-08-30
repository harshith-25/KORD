import { create } from "zustand";
import friendService from "@/services/friendService";

export const useFriendStore = create((set) => ({
  friends: [],
  friendRequests: [], // Incoming friend requests

  setFriends: (friends) => set({ friends: friends }),
  setFriendRequests: (requests) => set({ friendRequests: requests }),
  addFriendRequest: (request) =>
    set((state) => ({ friendRequests: [...state.friendRequests, request] })),
  removeFriendRequest: (requestId) =>
    set((state) => ({
      friendRequests: state.friendRequests.filter(
        (req) => req._id !== requestId
      ),
    })),
  addFriend: (friend) =>
    set((state) => ({ friends: [...state.friends, friend] })),
  removeFriend: (friendId) =>
    set((state) => ({
      friends: state.friends.filter((friend) => friend._id !== friendId),
    })),

  fetchFriends: async () => {
    try {
      const data = await friendService.getFriendsList();
      if (data.success) {
        set({ friends: data.data.friends });
      }
    } catch (error) {
      console.error("Failed to fetch friends:", error);
    }
  },

  fetchFriendRequests: async () => {
    try {
      const data = await friendService.getFriendRequests();
      if (data.success) {
        set({ friendRequests: data.data.requests });
      }
    } catch (error) {
      console.error("Failed to fetch friend requests:", error);
    }
  },

  sendFriendRequest: async (targetUserId) => {
    try {
      const data = await friendService.sendFriendRequest(targetUserId);
      if (data.success) {
        console.log("Friend request sent:", data.message);
      }
    } catch (error) {
      console.error("Failed to send friend request:", error);
      throw error;
    }
  },

  acceptFriendRequest: async (requestId) => {
    try {
      const data = await friendService.acceptFriendRequest(requestId);
      if (data.success) {
        set((state) => ({
          friendRequests: state.friendRequests.filter(
            (req) => req._id !== requestId
          ),
          friends: [...state.friends, data.data.friend], // Assuming friend data is returned
        }));
        console.log("Friend request accepted:", data.message);
      }
    } catch (error) {
      console.error("Failed to accept friend request:", error);
      throw error;
    }
  },

  rejectFriendRequest: async (requestId) => {
    try {
      const data = await friendService.rejectFriendRequest(requestId);
      if (data.success) {
        set((state) => ({
          friendRequests: state.friendRequests.filter(
            (req) => req._id !== requestId
          ),
        }));
        console.log("Friend request rejected:", data.message);
      }
    } catch (error) {
      console.error("Failed to reject friend request:", error);
      throw error;
    }
  },

  unfriend: async (friendId) => {
    try {
      const data = await friendService.unfriend(friendId);
      if (data.success) {
        set((state) => ({
          friends: state.friends.filter((friend) => friend._id !== friendId),
        }));
        console.log("Unfriended successfully:", data.message);
      }
    } catch (error) {
      console.error("Failed to unfriend:", error);
      throw error;
    }
  },
}));