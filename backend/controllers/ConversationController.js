import Conversation from "../models/ConversationModel.js";
import Message from "../models/MessagesModel.js";
import Channel from "../models/ChannelModel.js";

class ConversationController {
  // Get or create conversation based on type and participants
  async getOrCreateConversation(req, res) {
    try {
      const { type, participants, name } = req.body;
      const userId = req.user._id;

      let conversation;

      if (type === "direct") {
        if (participants.length !== 2) {
          return res.status(400).json({
            error: "Direct conversation needs exactly 2 participants",
          });
        }

        conversation = await Conversation.findDirectConversation(
          participants[0],
          participants[1]
        );

        if (!conversation) {
          conversation = new Conversation({
            type: "direct",
            participants: participants.map((p) => ({
              user: p,
              role: "member",
            })),
            createdBy: userId,
            directParticipants: participants,
          });
          await conversation.save();
        }
      } else {
        conversation = new Conversation({
          type,
          name,
          participants: participants.map((p) => ({ user: p, role: "member" })),
          createdBy: userId,
        });
        await conversation.save();
      }

      return res.json({ conversation });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Send message to conversation
  async sendMessage(req, res) {
    try {
      const { conversationId } = req.params;
      const { content, type = "text", replyTo } = req.body;
      const senderId = req.user._id;

      const conversation = await Conversation.findOne({
        conversationId,
        "participants.user": senderId,
        "participants.isActive": true,
      });

      if (!conversation) {
        return res
          .status(404)
          .json({ error: "Conversation not found or access denied" });
      }

      const message = new Message({
        sender: senderId,
        conversationId,
        content,
        type,
        replyTo,
        // Set legacy fields for backward compatibility
        ...(conversation.type === "direct"
          ? {
              recipient: conversation.directParticipants.find(
                (id) => id.toString() !== senderId.toString()
              ),
            }
          : {
              channel:
                conversation.type === "channel" ? conversation._id : null,
            }),
      });

      await message.save();
      await conversation.updateLastMessage(message);

      const populatedMessage = await Message.findById(message._id)
        .populate("sender", "name avatar")
        .populate("replyTo", "content sender");

      return res.json({ message: populatedMessage });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Get conversation messages
  async getMessages(req, res) {
    try {
      const { conversationId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const userId = req.user._id;

      const conversation = await Conversation.findOne({
        conversationId,
        "participants.user": userId,
        "participants.isActive": true,
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const messages = await Message.findConversationMessages(conversationId, {
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit),
        userId,
      });

      return res.json({ messages });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Get user conversations
  async getUserConversations(req, res) {
    try {
      const userId = req.user._id;
      const { type, page = 1, limit = 20 } = req.query;

      const conversations = await Conversation.findUserConversations(userId, {
        type,
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit),
      });

      return res.json({ conversations });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Add participant to conversation
  async addParticipant(req, res) {
    try {
      const { conversationId } = req.params;
      const { userId: newUserId, role = "member" } = req.body;
      const requesterId = req.user._id;

      const conversation = await Conversation.findOne({
        conversationId,
        "participants.user": requesterId,
        "participants.isActive": true,
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      if (conversation.type === "direct") {
        return res
          .status(400)
          .json({ error: "Cannot add participants to direct conversation" });
      }

      const requesterRole = conversation.getParticipantRole(requesterId);
      if (
        requesterRole !== "admin" &&
        !conversation.settings.allowMemberToAddOthers
      ) {
        return res.status(403).json({ error: "Permission denied" });
      }

      await conversation.addParticipant(newUserId, role);
      return res.json({ message: "Participant added successfully" });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Remove participant from conversation
  async removeParticipant(req, res) {
    try {
      const { conversationId } = req.params;
      const { userId: targetUserId } = req.body;
      const requesterId = req.user._id;

      const conversation = await Conversation.findOne({
        conversationId,
        "participants.user": requesterId,
        "participants.isActive": true,
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      if (conversation.type === "direct") {
        return res.status(400).json({
          error: "Cannot remove participants from direct conversation",
        });
      }

      const requesterRole = conversation.getParticipantRole(requesterId);
      if (
        requesterRole !== "admin" &&
        requesterId.toString() !== targetUserId.toString()
      ) {
        return res.status(403).json({ error: "Permission denied" });
      }

      await conversation.removeParticipant(targetUserId);
      return res.json({ message: "Participant removed successfully" });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Update conversation info
  async updateConversation(req, res) {
    try {
      const { conversationId } = req.params;
      const { name, description, avatar } = req.body;
      const userId = req.user._id;

      const conversation = await Conversation.findOne({
        conversationId,
        "participants.user": userId,
        "participants.isActive": true,
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const userRole = conversation.getParticipantRole(userId);
      if (
        userRole !== "admin" &&
        !conversation.settings.allowMemberToEditInfo
      ) {
        return res.status(403).json({ error: "Permission denied" });
      }

      if (name) conversation.name = name;
      if (description) conversation.description = description;
      if (avatar) conversation.avatar = avatar;

      await conversation.save();
      return res.json({ conversation });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Archive conversation for user
  async archiveConversation(req, res) {
    try {
      const { conversationId } = req.params;
      const userId = req.user._id;

      const conversation = await Conversation.findOne({
        conversationId,
        "participants.user": userId,
        "participants.isActive": true,
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      if (!conversation.archivedBy.includes(userId)) {
        conversation.archivedBy.push(userId);
        await conversation.save();
      }

      return res.json({ message: "Conversation archived" });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Get conversation info
  async getConversationInfo(req, res) {
    try {
      const { conversationId } = req.params;
      const userId = req.user._id;

      const conversation = await Conversation.findOne({
        conversationId,
        "participants.user": userId,
        "participants.isActive": true,
      })
        .populate("participants.user", "name avatar email")
        .populate("createdBy", "name avatar");

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      return res.json({ conversation });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Mark messages as read
  async markAsRead(req, res) {
    try {
      const { conversationId } = req.params;
      const { messageId } = req.body;
      const userId = req.user._id;

      const conversation = await Conversation.findOne({
        conversationId,
        "participants.user": userId,
        "participants.isActive": true,
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Update participant's last read message
      const participant = conversation.participants.find(
        (p) => p.user.toString() === userId.toString()
      );

      if (participant) {
        participant.lastReadMessageId = messageId;
        participant.lastReadAt = new Date();
        await conversation.save();
      }

      return res.json({ message: "Marked as read" });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Migration helper: Convert channel to conversation
  async migrateChannelToConversation(channelId) {
    try {
      const channel = await Channel.findById(channelId);
      if (!channel) throw new Error("Channel not found");

      const conversation = new Conversation({
        conversationId: `channel_${channelId}`,
        type: "channel",
        name: channel.name,
        description: channel.description,
        avatar: channel.avatar,
        participants: channel.members.map((member) => ({
          user: member.user,
          role: member.role,
          joinedAt: member.joinedAt,
          isActive: member.isActive,
          permissions: member.permissions,
          lastReadMessageId: member.lastReadMessageId,
          lastReadAt: member.lastReadAt,
        })),
        createdBy: channel.createdBy,
        lastMessage: channel.lastMessage,
        lastActivity: channel.lastActivity,
        isActive: channel.isActive,
        isArchived: channel.isArchived,
        isPrivate: channel.isPrivate,
        settings: channel.settings,
        messageCount: channel.messageCount,
        category: channel.category,
        pinnedMessages: channel.pinnedMessages,
      });

      await conversation.save();

      // Update channel with conversationId
      channel.conversationId = conversation.conversationId;
      await channel.save();

      return conversation;
    } catch (error) {
      throw error;
    }
  }
}

export default new ConversationController();