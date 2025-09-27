import { format, isToday, isYesterday, isSameDay } from "date-fns";

export const formatTimeSafe = (time) => {
  try {
    if (!time) return "";
    const date = new Date(time);
    if (isNaN(date.getTime())) return "";
    return format(date, "p");
  } catch (error) {
    console.error("Error formatting time:", error);
    return "";
  }
};

// /**
//  * Format date separator for chat
//  * @param {string|Date} date - The date to format
//  * @returns {string} Formatted date string
//  */
export const formatDateSeparator = (date) => {
  try {
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return "Unknown Date";
    }

    if (isToday(parsedDate)) return "Today";
    if (isYesterday(parsedDate)) return "Yesterday";
    return format(parsedDate, "MMMM dd, yyyy");
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Unknown Date";
  }
};

// /**
//  * Safely compare if two dates are on the same day
//  * @param {string|Date} date1 - First date
//  * @param {string|Date} date2 - Second date
//  * @returns {boolean} True if dates are on the same day
//  */
export const isSameDaySafe = (date1, date2) => {
  try {
    if (!date1 || !date2) return false;
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
    return isSameDay(d1, d2);
  } catch (error) {
    console.error("Error comparing dates:", error);
    return false;
  }
};

// /**
//  * Determine if messages should be grouped together
//  * @param {Object} currentMsg - Current message
//  * @param {Object} prevMsg - Previous message
//  * @returns {boolean} True if messages should be grouped
//  */
export const shouldGroupMessage = (currentMsg, prevMsg) => {
  if (!prevMsg || !currentMsg) return false;
  if (!currentMsg.time || !prevMsg.time) return false;

  try {
    const currentTime = new Date(currentMsg.time);
    const prevTime = new Date(prevMsg.time);

    // Check if dates are valid
    if (isNaN(currentTime.getTime()) || isNaN(prevTime.getTime())) {
      return false;
    }

    const timeDiff = currentTime - prevTime;
    const sameUser =
      currentMsg.type === prevMsg.type &&
      currentMsg.senderId === prevMsg.senderId;
    const withinTimeLimit = timeDiff < 5 * 60 * 1000; // 5 minutes

    return sameUser && withinTimeLimit;
  } catch (error) {
    console.error("Error in shouldGroupMessage:", error);
    return false;
  }
};

// /**
//  * Generate initials from a name
//  * @param {string} name - Full name
//  * @returns {string} Initials (max 2 characters)
//  */
export const getInitials = (name) => {
  if (!name || typeof name !== "string") return "??";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

// /**
//  * Check if a chat is a group or channel
//  * @param {Object} chat - Chat object
//  * @returns {boolean} True if it's a group or channel
//  */
// export const isGroupOrChannel = (chat) => {
//   if (!chat) return false;
//   return (
//     chat.type === "group" || chat.type === "channel" || chat.isGroup === true
//   );
// };

// /**
//  * Get user display name for messages
//  * @param {Object} message - Message object
//  * @param {Object} chat - Chat object
//  * @param {Array} contacts - Array of contacts
//  * @returns {string} Display name or null for direct messages
//  */
export const getMessageDisplayName = (message, chat, contacts) => {
  // Only show names in groups/channels
  if (!isGroupOrChannel(chat)) return null;

  // Don't show name for sent messages
  if (message.type === "sent") return null;

  // Find sender info
  const sender = contacts?.find((contact) => contact.id === message.senderId);
  return sender?.name || message.senderName || "Unknown User";
};

// /**
//  * Get avatar for message sender
//  * @param {Object} message - Message object
//  * @param {Object} chat - Chat object
//  * @param {Array} contacts - Array of contacts
//  * @returns {Object|null} Avatar info object or null
//  */
export const getMessageAvatar = (message, chat, contacts) => {
  // Only show avatars in groups/channels
  if (!isGroupOrChannel(chat)) return null;

  // Don't show avatar for sent messages
  if (message.type === "sent") return null;

  // Find sender info
  const sender = contacts?.find((contact) => contact.id === message.senderId);

  return {
    src: sender?.avatar || message.senderAvatar,
    name: sender?.name || message.senderName || "Unknown User",
  };
};

// /**
//  * Validate message object
//  * @param {any} message - Message to validate
//  * @param {number} index - Message index for logging
//  * @returns {boolean} True if message is valid
//  */
export const isValidMessage = (message, index) => {
  if (!message || typeof message !== "object") {
    console.warn("Invalid message at index", index, message);
    return false;
  }
  return true;
};

// /**
//  * Get message content safely
//  * @param {Object} message - Message object
//  * @returns {string} Message content
//  */
export const getMessageContent = (message) => {
  return message.text || message.content || message.message || "No content";
};

// /**
//  * Generate gradient colors for avatars
//  * @param {string} id - User ID or name
//  * @returns {string} Tailwind gradient class
//  */
export const getAvatarGradient = (id) => {
  const gradients = [
    "from-purple-400 to-purple-600",
    "from-blue-400 to-blue-600",
    "from-green-400 to-green-600",
    "from-yellow-400 to-yellow-600",
    "from-red-400 to-red-600",
    "from-pink-400 to-pink-600",
    "from-indigo-400 to-indigo-600",
    "from-teal-400 to-teal-600",
  ];

  // Simple hash function to consistently assign colors
  let hash = 0;
  if (id) {
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash + id.charCodeAt(i)) & 0xffffffff;
    }
  }

  return gradients[Math.abs(hash) % gradients.length];
};