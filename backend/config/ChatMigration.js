import mongoose from "mongoose";
import Channel from "../models/ChannelModel.js";
import Message from "../models/MessagesModel.js";
import Conversation from "../models/ConversationModel.js";
import User from "../models/UserModel.js";

class ChatMigration {
  async migrateToUnifiedChat() {
    console.log("Starting migration to unified chat system...");

    try {
      // Step 1: Migrate channels to have conversationId
      await this.migrateChannelConversationIds();

      // Step 2: Create conversation documents from channels
      await this.createConversationsFromChannels();

      // Step 3: Create conversation documents from direct messages
      await this.createConversationsFromDirectMessages();

      // Step 4: Update all messages with conversationId
      await this.migrateMessageConversationIds();

      console.log("Migration completed successfully!");
    } catch (error) {
      console.error("Migration failed:", error);
      throw error;
    }
  }

  async migrateChannelConversationIds() {
    console.log("Step 1: Adding conversationId to channels...");

    const channelsWithoutConversationId = await Channel.find({
      conversationId: { $exists: false },
    });

    let updated = 0;
    for (const channel of channelsWithoutConversationId) {
      channel.conversationId = `channel_${channel._id.toString()}`;
      await channel.save();
      updated++;
    }

    console.log(`Updated ${updated} channels with conversationId`);
  }

  async createConversationsFromChannels() {
    console.log("Step 2: Creating conversation documents from channels...");

    const channels = await Channel.find({ isActive: true });
    let created = 0;

    for (const channel of channels) {
      // Check if conversation already exists
      const existingConversation = await Conversation.findOne({
        conversationId: channel.conversationId,
      });

      if (existingConversation) continue;

      // Create new conversation from channel
      const conversationData = channel.toConversation();
      const conversation = new Conversation(conversationData);

      await conversation.save();
      created++;
    }

    console.log(`Created ${created} conversations from channels`);
  }

  async createConversationsFromDirectMessages() {
    console.log(
      "Step 3: Creating conversation documents from direct messages..."
    );

    // Find all unique direct message pairs
    const directMessagePairs = await Message.aggregate([
      {
        $match: {
          recipient: { $exists: true },
          sender: { $exists: true },
        },
      },
      {
        $group: {
          _id: {
            participants: {
              $cond: {
                if: { $lt: ["$sender", "$recipient"] },
                then: ["$sender", "$recipient"],
                else: ["$recipient", "$sender"],
              },
            },
          },
          lastMessage: { $last: "$ROOT" },
          messageCount: { $sum: 1 },
        },
      },
    ]);

    let created = 0;
    for (const pair of directMessagePairs) {
      const [user1, user2] = pair._id.participants;
      const conversationId = `direct_${user1.toString()}_${user2.toString()}`;

      // Check if conversation already exists
      const existingConversation = await Conversation.findOne({
        conversationId,
      });
      if (existingConversation) continue;

      // Create direct conversation
      const conversation = new Conversation({
        conversationId,
        type: "direct",
        participants: [
          { user: user1, role: "member", isActive: true },
          { user: user2, role: "member", isActive: true },
        ],
        directParticipants: [user1, user2],
        createdBy: pair.lastMessage.sender,
        lastMessage: {
          messageId: pair.lastMessage._id,
          content: pair.lastMessage.content?.toString().substring(0, 200) || "",
          type: pair.lastMessage.type,
          sender: pair.lastMessage.sender,
          timestamp: pair.lastMessage.timestamp,
        },
        lastActivity: pair.lastMessage.timestamp,
        messageCount: pair.messageCount,
        isActive: true,
      });

      await conversation.save();
      created++;
    }

    console.log(`Created ${created} conversations from direct messages`);
  }

  async migrateMessageConversationIds() {
    console.log("Step 4: Adding conversationId to messages...");

    const messagesWithoutConversationId = await Message.find({
      conversationId: { $exists: false },
    });

    let updated = 0;
    for (const message of messagesWithoutConversationId) {
      if (message.recipient) {
        // Direct message
        const userIds = [
          message.sender.toString(),
          message.recipient.toString(),
        ].sort();
        message.conversationId = `direct_${userIds.join("_")}`;
      } else if (message.channel) {
        // Channel message
        message.conversationId = `channel_${message.channel.toString()}`;
      }

      if (message.conversationId) {
        await message.save();
        updated++;
      }
    }

    console.log(`Updated ${updated} messages with conversationId`);
  }

  async validateMigration() {
    console.log("Validating migration...");

    // Check messages without conversationId
    const messagesWithoutConversationId = await Message.countDocuments({
      conversationId: { $exists: false },
    });

    // Check channels without conversationId
    const channelsWithoutConversationId = await Channel.countDocuments({
      conversationId: { $exists: false },
    });

    // Check conversations count
    const conversationsCount = await Conversation.countDocuments();
    const channelsCount = await Channel.countDocuments({ isActive: true });

    console.log("Migration Validation Results:");
    console.log(
      `Messages without conversationId: ${messagesWithoutConversationId}`
    );
    console.log(
      `Channels without conversationId: ${channelsWithoutConversationId}`
    );
    console.log(`Total conversations created: ${conversationsCount}`);
    console.log(`Total active channels: ${channelsCount}`);

    if (
      messagesWithoutConversationId === 0 &&
      channelsWithoutConversationId === 0
    ) {
      console.log("✅ Migration validation passed!");
      return true;
    } else {
      console.log("❌ Migration validation failed!");
      return false;
    }
  }

  async rollback() {
    console.log("Rolling back migration...");

    try {
      // Remove conversationId from channels
      await Channel.updateMany({}, { $unset: { conversationId: 1 } });

      // Remove conversationId from messages
      await Message.updateMany({}, { $unset: { conversationId: 1 } });

      // Delete all conversations
      await Conversation.deleteMany({});

      console.log("Rollback completed successfully!");
    } catch (error) {
      console.error("Rollback failed:", error);
      throw error;
    }
  }
}

// Migration script runner
async function runMigration() {
  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("Connected to MongoDB");
    }

    const migration = new ChatMigration();

    // Run migration
    await migration.migrateToUnifiedChat();

    // Validate migration
    const isValid = await migration.validateMigration();

    if (!isValid) {
      console.log("Migration validation failed. Consider running rollback.");
      process.exit(1);
    }

    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration script failed:", error);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration();
}

export default ChatMigration;