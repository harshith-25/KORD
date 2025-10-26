export const HOST =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

// --- Authentication Routes ---
export const AUTH_ROUTES = "/api/auth";
export const REGISTER_ROUTE = `${AUTH_ROUTES}/register`;
export const LOGIN_ROUTE = `${AUTH_ROUTES}/login`;
export const LOGOUT_ROUTE = `${AUTH_ROUTES}/logout`;
export const REFRESH_TOKEN_ROUTE = `${AUTH_ROUTES}/refresh-token`;
export const VERIFY_EMAIL_ROUTE = `${AUTH_ROUTES}/verify-email`;
export const FORGOT_PASSWORD_ROUTE = `${AUTH_ROUTES}/forgot-password`;
export const RESET_PASSWORD_ROUTE = `${AUTH_ROUTES}/reset-password`;

// --- User/Profile Routes (under /api/users) ---
export const USERS_ROUTES = "/api/users"; // This is correct from app.js
export const GET_USER_PROFILE_ROUTE = `${USERS_ROUTES}/`; // Append userId later
export const UPDATE_USER_PROFILE_ROUTE = `${USERS_ROUTES}/`;
export const UPDATE_PROFILE_IMAGE_ROUTE = `${USERS_ROUTES}/profile-image`;
export const DELETE_PROFILE_IMAGE_ROUTE = `${USERS_ROUTES}/profile-image`;
export const CHANGE_PASSWORD_ROUTE = `${USERS_ROUTES}/change-password`;
export const DELETE_ACCOUNT_ROUTE = `${USERS_ROUTES}/delete-account`;

// --- User Status Routes (also under /api/users) ---
export const UPDATE_USER_STATUS_ROUTE = `${USERS_ROUTES}/status`;
export const GET_USER_STATUS_ROUTE = `${USERS_ROUTES}/status`; // Append userId later
export const GET_MULTIPLE_USERS_STATUS_ROUTE = `${USERS_ROUTES}/status/multiple`;
export const START_LIVE_LOCATION_ROUTE = `${USERS_ROUTES}/live-location/start`;
export const STOP_LIVE_LOCATION_ROUTE = `${USERS_ROUTES}/live-location/stop`;
export const GET_LIVE_LOCATION_ROUTE = `${USERS_ROUTES}/live-location`; // Append targetUserId later

// --- Contact Routes (also under /api/users) ---
export const SEARCH_CONTACTS_ROUTE = `${USERS_ROUTES}/search-contacts`; // ✅ Matches backend
export const GET_DM_CONTACTS_ROUTE = `${USERS_ROUTES}/contacts/dm-list`; // ✅ Matches backend
export const GET_ALL_CONTACTS_ROUTE = `${USERS_ROUTES}/all-contacts`; // ✅ Matches backend

// --- NEW ROUTE FOR DM INITIATION ---
// export const INITIATE_DM_ROUTE = `${USERS_ROUTES}/initiate-dm`; // Matches new route in userRoutes.js

// --- Message Routes ---
export const MESSAGE_ROUTES = "/api/messages";
export const SEND_MESSAGE_ROUTE = `${MESSAGE_ROUTES}/send`; // Assuming a send endpoint
export const SEARCH_MESSAGES_ROUTE = `${MESSAGE_ROUTES}/search`;
export const GET_ALL_MESSAGES_ROUTE = (conversationId) =>
  `${MESSAGE_ROUTES}/${conversationId}`;
export const EDIT_MESSAGE_ROUTE = (messageId) =>
  `${MESSAGE_ROUTES}/${messageId}`;
export const DELETE_MESSAGE_ROUTE = (messageId) =>
  `${MESSAGE_ROUTES}/${messageId}`;
export const ADD_REACTION_ROUTE = (messageId) =>
  `${MESSAGE_ROUTES}/${messageId}/react`;
export const REMOVE_REACTION_ROUTE = (messageId, emoji) =>
  `${MESSAGE_ROUTES}/${messageId}/react/${emoji}`;
export const FORWARD_MESSAGE_ROUTE = (messageId) =>
  `${MESSAGE_ROUTES}/${messageId}/forward`;

// --- Channel Routes ---
export const CHANNEL_ROUTES = "/api/channels";
export const CREATE_CHANNEL_ROUTE = `${CHANNEL_ROUTES}/create`;
export const GET_CHANNEL_DETAILS_ROUTE = `${CHANNEL_ROUTES}`; // Append channelId later
export const JOIN_CHANNEL_ROUTE = `${CHANNEL_ROUTES}/join`; // Append channelId later
export const LEAVE_CHANNEL_ROUTE = `${CHANNEL_ROUTES}/leave`; // Append channelId later

// --- Conversation Routes ---
export const CONVERSATION_ROUTES = "/api/conversations";
export const CREATE_DIRECT_CONVERSATION = `${CONVERSATION_ROUTES}/direct`;
export const CREATE_GROUP_OR_CHANNEL = `${CONVERSATION_ROUTES}/`;

// --- Notification Routes ---
export const NOTIFICATION_ROUTES = "/api/notifications";
export const GET_ALL_NOTIFICATIONS_ROUTE = `${NOTIFICATION_ROUTES}/`;
export const MARK_NOTIFICATION_READ_ROUTE = `${NOTIFICATION_ROUTES}/read`; // Append notificationId later

// --- Poll Routes ---
export const POLL_ROUTES = "/api/polls";
export const CREATE_POLL_ROUTE = `${POLL_ROUTES}/create`;
export const GET_POLL_DETAILS_ROUTE = `${POLL_ROUTES}`; // Append pollId later
export const VOTE_POLL_ROUTE = `${POLL_ROUTES}/vote`; // Append pollId later

// --- Whiteboard Routes ---
export const WHITEBOARD_ROUTES = "/api/whiteboards";
export const CREATE_WHITEBOARD_ROUTE = `${WHITEBOARD_ROUTES}/create`;
export const GET_WHITEBOARD_DETAILS_ROUTE = `${WHITEBOARD_ROUTES}`; // Append whiteboardId later
export const UPDATE_WHITEBOARD_ROUTE = `${WHITEBOARD_ROUTES}/update`; // Append whiteboardId later

// --- Friend Routes ---
export const FRIEND_ROUTES = "/api/friends";
export const SEND_FRIEND_REQUEST_ROUTE = `${FRIEND_ROUTES}/request`;
export const ACCEPT_FRIEND_REQUEST_ROUTE = `${FRIEND_ROUTES}/accept`; // Append requestId later
export const REJECT_FRIEND_REQUEST_ROUTE = `${FRIEND_ROUTES}/reject`; // Append requestId later
export const GET_FRIEND_REQUESTS_ROUTE = `${FRIEND_ROUTES}/requests`;
export const REMOVE_FRIEND_ROUTE = `${FRIEND_ROUTES}/remove`; // Append friendId later
export const GET_FRIENDS_ROUTE = `${FRIEND_ROUTES}/`;

// --- Admin Routes ---
export const ADMIN_ROUTES = "/api/admin";
export const GET_ALL_USERS_ADMIN_ROUTE = `${ADMIN_ROUTES}/users`;
export const GET_USER_DETAILS_ADMIN_ROUTE = `${ADMIN_ROUTES}/users`; // Append userId later
export const UPDATE_USER_ROLE_ADMIN_ROUTE = `${ADMIN_ROUTES}/users/role`; // Append userId later
export const DELETE_USER_ADMIN_ROUTE = `${ADMIN_ROUTES}/users`; // Append userId later
