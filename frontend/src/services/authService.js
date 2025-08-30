import axiosInstance from "@/utils/axiosInstance";
import {
  LOGIN_ROUTE,
  SIGNUP_ROUTE,
  GET_USER_INFO_ROUTE,
  UPDATE_PROFILE_ROUTE,
  ADD_PROFILE_IMAGE_ROUTE,
  REMOVE_PROFILE_IMAGE_ROUTE,
  LOGOUT_ROUTE,
} from "@/utils/ApiRoutes";

const authService = {
  login: async (email, password) => {
    const response = await axiosInstance.post(LOGIN_ROUTE, { email, password });
    return response.data;
  },

  register: async (name, email, password) => {
    const response = await axiosInstance.post(SIGNUP_ROUTE, {
      name,
      email,
      password,
    });
    return response.data;
  },

  getUserInfo: async () => {
    const response = await axiosInstance.get(GET_USER_INFO_ROUTE);
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await axiosInstance.put(UPDATE_PROFILE_ROUTE, profileData);
    return response.data;
  },

  addProfileImage: async (formData) => {
    // formData for file upload
    const response = await axiosInstance.post(
      ADD_PROFILE_IMAGE_ROUTE,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      }
    );
    return response.data;
  },

  removeProfileImage: async () => {
    const response = await axiosInstance.delete(REMOVE_PROFILE_IMAGE_ROUTE);
    return response.data;
  },

  logout: async () => {
    const response = await axiosInstance.post(LOGOUT_ROUTE);
    return response.data;
  },
};

export default authService;