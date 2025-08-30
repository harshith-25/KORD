import api from "@/utils/axiosInstance";
import {
  SEARCH_CONTACTS_ROUTE,
  GET_DM_CONTACTS_ROUTE,
  GET_ALL_CONTACTS_ROUTE,
} from "@/utils/ApiRoutes";

const contactService = {
  searchContacts: async (query) => {
    const response = await api.post(SEARCH_CONTACTS_ROUTE, {
      searchTerm: query,
    });

    return response.data.contacts;
  },

  getDmContacts: async () => {
    const response = await api.get(GET_DM_CONTACTS_ROUTE);
    return response.data;
  },

  getAllContacts: async () => {
    const response = await api.get(GET_ALL_CONTACTS_ROUTE);
    return response.data;
  },
};

export default contactService;
