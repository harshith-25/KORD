import mongoose from "mongoose";
import User from "../models/UserModel.js";
import Message from "../models/MessagesModel.js";

export const searchContacts = async (req, res) => {
  try {
    const { searchTerm } = req.body;

    if (!searchTerm) {
      return res.status(400).send("Search Term is required.");
    }

    const sanitizedSearchTerm = searchTerm.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
    const regex = new RegExp(sanitizedSearchTerm, "i");

    const query = {
      $or: [{ firstName: regex }, { lastName: regex }, { email: regex }],
    };

    // Exclude self only if req.userId exists
    if (req.userId) {
      query._id = { $ne: req.userId };
    }

    const contacts = await User.find(query);

    return res.status(200).json({ contacts });
  } catch (error) {
    console.error("Error in searchContacts:", error);
    return res.status(500).send("Internal Server Error");
  }
};

export const getContactsForDMList = async (req, res) => {
  try {
    let { userId } = req;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const contacts = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: userObjectId }, { recipient: userObjectId }],
        },
      },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: {
            $cond: {
              if: { $eq: ["$sender", userObjectId] }, // Fix: Use "$sender" (field reference)
              then: "$recipient",
              else: "$sender",
            },
          },
          lastMessageTime: { $first: "$timestamp" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "contactInfo",
        },
      },
      { $unwind: "$contactInfo" },
      {
        $project: {
          _id: 1,
          lastMessageTime: 1,
          email: "$contactInfo.email",
          firstName: "$contactInfo.firstName",
          lastName: "$contactInfo.lastName",
          image: "$contactInfo.image",
          color: "$contactInfo.color",
        },
      },
      { $sort: { lastMessageTime: -1 } },
    ]);

    return res.status(200).json({ contacts });
  } catch (error) {
    console.error("Error fetching DM contacts:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getAllContacts = async (req, res) => {
  try {
    const users = await User.find(
      { _id: { $ne: req.userId } },
      "firstName lastName _id email"
    );

    const contacts = users.map((user) => ({
      label: user.firstName ? `${user.firstName} ${user.lastName}` : user.email,
      value: user._id,
    }));

    return res.status(200).json({ contacts });
  } catch (error) {
    console.log(error);
    return res.status(500).send("Internal Server Error");
  }
};

// --- NEW FUNCTION FOR DM INITIATION ---
export const initiateDirectMessage = async (req, res) => {
  try {
    const { targetUserId } = req.body; // The ID of the user to start a DM with
    const currentUserId = req.userId; // Current authenticated user's ID (set in verifyToken middleware)

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: "Target user ID is required.",
      });
    }

    // Convert to ObjectIds safely
    const currentObjectId = new mongoose.Types.ObjectId(currentUserId);
    const targetObjectId = new mongoose.Types.ObjectId(targetUserId);

    // ✅ 2. Prevent self-DM
    if (currentObjectId.equals(targetObjectId)) {
      return res.status(400).json({
        success: false,
        message: "Cannot start a DM with yourself.",
      });
    }

    // ✅ 3. Verify target user exists and has completed profile
    const targetUser = await User.findOne(
      { _id: targetObjectId, profileSetup: true },
      "firstName lastName email image color _id"
    );

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "Target user not found or profile not set up.",
      });
    }

    // ✅ 4. Check if a DM already exists (based on message history without channel)
    const existingMessage = await Message.findOne({
      $or: [
        { sender: currentObjectId, recipient: targetObjectId },
        { sender: targetObjectId, recipient: currentObjectId },
      ],
      channel: { $exists: false }, // only direct messages
    });

    // Decide response message and status
    const responseMessage = existingMessage
      ? "DM channel retrieved successfully."
      : "New DM channel ready. No prior messages found.";

    const statusCode = existingMessage ? 200 : 201;

    // ✅ 5. Return clean response
    return res.status(statusCode).json({
      success: true,
      message: responseMessage,
      dmPartner: {
        _id: targetUser._id,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        email: targetUser.email,
        image: targetUser.image,
        color: targetUser.color,
      },
      isNewConversation: !existingMessage,
    });
  } catch (error) {
    console.error("Error initiating direct message:", error);
    return res.status(500).json({
      success: false,
      message: "Error initiating direct message.",
      error: error.message,
    });
  }
};