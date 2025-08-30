import axiosInstance from "@/utils/axiosInstance";
import {
  SEND_MESSAGE_ROUTE,
  GET_ALL_MESSAGES_ROUTE,
  UPLOAD_FILE_ROUTE,
  EDIT_MESSAGE_ROUTE,
  DELETE_MESSAGE_ROUTE,
} from "@/utils/ApiRoutes";

const messageService = {
  sendMessage: async (messageData) => {
    // { chatId, senderId, text, fileId? }
    const response = await axiosInstance.post(SEND_MESSAGE_ROUTE, messageData);
    return response.data;
  },

  getMessages: async (chatId) => {
    const response = await axiosInstance.get(
      `<span class="math-inline">\{GET\_ALL\_MESSAGES\_ROUTE\}/</span>{chatId}`
    );
    return response.data;
  },

  uploadFile: async (formData) => {
    // formData for file upload
    const response = await axiosInstance.post(UPLOAD_FILE_ROUTE, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  editMessage: async (messageId, newData) => {
    // { text, fileId? }
    const response = await axiosInstance.put(
      `<span class="math-inline">\{EDIT\_MESSAGE\_ROUTE\}/</span>{messageId}`,
      newData
    );
    return response.data;
  },

  deleteMessage: async (messageId) => {
    const response = await axiosInstance.delete(
      `<span class="math-inline">\{DELETE\_MESSAGE\_ROUTE\}/</span>{messageId}`
    );
    return response.data;
  },
};

export default messageService;