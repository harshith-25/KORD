import { create } from "zustand";
import channelService from "@/services/channelService";

export const useChannelStore = create((set) => ({
  channels: [],
  activeChannelId: null,

  setChannels: (channels) => set({ channels: channels }),
  addChannel: (channel) =>
    set((state) => ({ channels: [...state.channels, channel] })),
  setActiveChannelId: (id) => set({ activeChannelId: id }),

  fetchUserChannels: async () => {
    try {
      const data = await channelService.getUserChannels();
      if (data.success) {
        set({ channels: data.data.channels });
      }
    } catch (error) {
      console.error("Failed to fetch user channels:", error);
    }
  },

  createChannel: async (name, description) => {
    try {
      const data = await channelService.createChannel(name, description);
      if (data.success) {
        set((state) => ({ channels: [...state.channels, data.data.channel] }));
        return data.data.channel;
      }
    } catch (error) {
      console.error("Failed to create channel:", error);
      throw error;
    }
  },
}));