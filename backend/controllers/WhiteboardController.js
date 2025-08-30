import WhiteboardSession from "../models/WhiteboardSessionModel.js"; // You will need to create this model
import Channel from "../models/ChannelModel.js";
import User from "../models/UserModel.js";
import mongoose from "mongoose";

const sendErrorResponse = (
  res,
  error,
  message = "Internal Server Error",
  statusCode = 500
) => {
  console.error(error);
  return res.status(statusCode).send(message);
};

/**
 * @description Creates a new collaborative whiteboard session.
 * IMPORTANT: This endpoint only creates the session. The actual real-time drawing and
 * synchronization will be handled by a WebSocket (Socket.IO) connection.
 */
export const createWhiteboardSession = async (req, res) => {
  try {
    const { channelId, recipientId, name } = req.body;
    const creatorId = req.userId;

    if (!channelId && !recipientId) {
      return res
        .status(400)
        .send(
          "Either a channelId or recipientId is required for a whiteboard session."
        );
    }
    if (channelId && !mongoose.Types.ObjectId.isValid(channelId)) {
      return res.status(400).send("Invalid channel ID format.");
    }
    if (recipientId && !mongoose.Types.ObjectId.isValid(recipientId)) {
      return res.status(400).send("Invalid recipient ID format.");
    }

    let sessionData = {
      creator: creatorId,
      name:
        name || `Whiteboard Session by ${req.user.firstName || req.user.email}`, // Assuming req.user is populated by auth middleware
      isActive: true,
      lastActivity: new Date(),
    };

    if (channelId) {
      const channel = await Channel.findById(channelId);
      if (!channel) return res.status(404).send("Channel not found.");
      // Ensure creator is a member of the channel
      if (
        !channel.members.includes(creatorId) &&
        channel.admin.toString() !== creatorId.toString()
      ) {
        return res
          .status(403)
          .send(
            "You are not authorized to create a whiteboard session in this channel."
          );
      }
      sessionData.channel = channelId;
      sessionData.participants = channel.members; // All channel members are potential participants
    } else if (recipientId) {
      const recipient = await User.findById(recipientId);
      if (!recipient) return res.status(404).send("Recipient not found.");
      sessionData.participants = [creatorId, recipientId];
      sessionData.recipient = recipientId; // For DM-specific sessions
    } else {
      return res
        .status(400)
        .send("A channel ID or recipient ID must be provided.");
    }

    const newSession = new WhiteboardSession(sessionData);
    await newSession.save();

    // You would typically emit a message or event via Socket.IO to notify participants
    // io.to(channelId || creatorId).to(recipientId).emit('newWhiteboardSession', newSession);

    return res
      .status(201)
      .json({ message: "Whiteboard session created.", session: newSession });
  } catch (error) {
    return sendErrorResponse(res, error, "Error creating whiteboard session.");
  }
};

export const getWhiteboardSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).send("Invalid session ID format.");
    }

    const session = await WhiteboardSession.findById(sessionId)
      .populate("creator", "firstName lastName image")
      .populate("participants", "firstName lastName image");

    if (!session) {
      return res.status(404).send("Whiteboard session not found.");
    }

    // Check if the user is a participant
    if (
      !session.participants.some((p) => p._id.toString() === userId.toString())
    ) {
      return res
        .status(403)
        .send("You are not authorized to access this whiteboard session.");
    }

    return res.status(200).json({ session });
  } catch (error) {
    return sendErrorResponse(res, error, "Error fetching whiteboard session.");
  }
};

export const endWhiteboardSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).send("Invalid session ID format.");
    }

    const session = await WhiteboardSession.findById(sessionId);
    if (!session) {
      return res.status(404).send("Whiteboard session not found.");
    }

    // Only creator or an admin can end the session
    const user = await User.findById(userId);
    if (
      session.creator.toString() !== userId.toString() &&
      (!user || user.role !== "admin")
    ) {
      return res
        .status(403)
        .send("Only the session creator or an admin can end this session.");
    }

    if (!session.isActive) {
      return res.status(200).send("Session is already inactive.");
    }

    session.isActive = false;
    await session.save();

    // Notify participants via Socket.IO that the session has ended
    // io.to(session.channel || session.creator).to(session.recipient).emit('whiteboardSessionEnded', { sessionId });

    return res.status(200).send("Whiteboard session ended successfully.");
  } catch (error) {
    return sendErrorResponse(res, error, "Error ending whiteboard session.");
  }
};