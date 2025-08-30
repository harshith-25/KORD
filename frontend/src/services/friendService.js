import axiosInstance from "@/utils/axiosInstance";
import {
  SEND_FRIEND_REQUEST_ROUTE,
  ACCEPT_FRIEND_REQUEST_ROUTE,
  REJECT_FRIEND_REQUEST_ROUTE,
  CANCEL_FRIEND_REQUEST_ROUTE,
  GET_FRIEND_REQUESTS_ROUTE,
  GET_FRIENDS_LIST_ROUTE,
  UNFRIEND_ROUTE,
} from "@/utils/ApiRoutes";

const friendService = {
  sendFriendRequest: async (targetUserId) => {
    const response = await axiosInstance.post(SEND_FRIEND_REQUEST_ROUTE, {
      targetUserId,
    });
    return response.data;
  },

  acceptFriendRequest: async (requestId) => {
    const response = await axiosInstance.post(
      `<span class="math-inline">\{ACCEPT\_FRIEND\_REQUEST\_ROUTE\}/</span>{requestId}`
    );
    return response.data;
  },

  rejectFriendRequest: async (requestId) => {
    const response = await axiosInstance.post(
      `<span class="math-inline">\{REJECT\_FRIEND\_REQUEST\_ROUTE\}/</span>{requestId}`
    );
    return response.data;
  },

  cancelFriendRequest: async (requestId) => {
    const response = await axiosInstance.delete(
      `<span class="math-inline">\{CANCEL\_FRIEND\_REQUEST\_ROUTE\}/</span>{requestId}`
    );
    return response.data;
  },

  getFriendRequests: async () => {
    const response = await axiosInstance.get(GET_FRIEND_REQUESTS_ROUTE);
    return response.data;
  },

  getFriendsList: async () => {
    const response = await axiosInstance.get(GET_FRIENDS_LIST_ROUTE);
    return response.data;
  },

  unfriend: async (friendId) => {
    const response = await axiosInstance.delete(
      `<span class="math-inline">\{UNFRIEND\_ROUTE\}/</span>{friendId}`
    );
    return response.data;
  },
};

export default friendService;