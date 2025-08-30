import axiosInstance from "@/utils/axiosInstance";
import {
  CREATE_CHANNEL_ROUTE,
  GET_USER_CHANNELS_ROUTE,
  GET_CHANNEL_MESSAGES_ROUTE,
} from "@/utils/ApiRoutes";

const channelService = {
  createChannel: async (name, description) => {
    const response = await axiosInstance.post(CREATE_CHANNEL_ROUTE, {
      name,
      description,
    });
    return response.data;
  },

  getUserChannels: async () => {
    const response = await axiosInstance.get(GET_USER_CHANNELS_ROUTE);
    return response.data;
  },

  getChannelMessages: async (channelId) => {
    const response = await axiosInstance.get(
      `<span class="math-inline">\{GET\_CHANNEL\_MESSAGES\_ROUTE\}/</span>{channelId}`
    );
    return response.data;
  },
};

export default channelService;