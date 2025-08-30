import Poll from "../models/PollModel.js"; // You will need to create this model
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

// Helper function to check if a location object is valid (basic check)
const isValidLocation = (location) => {
  return (
    location &&
    typeof location === "object" &&
    typeof location.name === "string" &&
    typeof location.address === "string" &&
    typeof location.latitude === "number" &&
    typeof location.longitude === "number"
  );
};

// Create a new poll
export const createPoll = async (req, res) => {
  try {
    const {
      question,
      options,
      isChannelPoll,
      targetId,
      allowMultipleVotes,
      expiresIn,
    } = req.body;
    const creatorId = req.userId;

    if (!question || !Array.isArray(options) || options.length < 2) {
      return res
        .status(400)
        .send("Poll question and at least two options are required.");
    }
    if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
      return res
        .status(400)
        .send("Valid targetId (channel or recipient ID) is required.");
    }

    // Validate options: each option must have 'text' and can optionally have 'location'
    for (const option of options) {
      if (typeof option.text !== "string" || option.text.trim() === "") {
        return res
          .status(400)
          .send("Each poll option must have a non-empty 'text' field.");
      }
      if (option.location && !isValidLocation(option.location)) {
        return res.status(400).send("Invalid location object in poll option.");
      }
    }

    let pollData = {
      question,
      options: options.map((opt) => ({
        text: opt.text,
        location: opt.location,
        votes: [],
      })), // Initialize votes array
      creator: creatorId,
      allowMultipleVotes: allowMultipleVotes || false,
      expiresAt: expiresIn
        ? new Date(Date.now() + expiresIn * 60 * 1000)
        : null, // expiresIn in minutes
    };

    if (isChannelPoll) {
      const channel = await Channel.findById(targetId);
      if (!channel) {
        return res.status(404).send("Channel not found.");
      }
      // Check if creator is a member of the channel
      if (
        !channel.members.includes(creatorId) &&
        channel.admin.toString() !== creatorId.toString()
      ) {
        return res
          .status(403)
          .send("You are not authorized to create a poll in this channel.");
      }
      pollData.channel = targetId;
    } else {
      // Direct message poll: ensure both users exist
      const recipient = await User.findById(targetId);
      if (!recipient) {
        return res.status(404).send("Recipient user not found.");
      }
      // A DM poll typically involves only two users, so we set both sender and recipient
      pollData.sender = creatorId;
      pollData.recipient = targetId;
    }

    const newPoll = new Poll(pollData);
    await newPoll.save();

    // You would likely emit this new poll via Socket.IO to relevant users/channel members
    // io.to(targetId).emit('newPoll', newPoll);

    return res.status(201).json({ poll: newPoll });
  } catch (error) {
    return sendErrorResponse(res, error, "Error creating poll.");
  }
};

// Vote on a poll
export const voteOnPoll = async (req, res) => {
  try {
    const { pollId } = req.params;
    const { optionIndex } = req.body; // Index of the option voted for
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(pollId)) {
      return res.status(400).send("Invalid poll ID format.");
    }
    if (typeof optionIndex !== "number" || optionIndex < 0) {
      return res.status(400).send("Valid option index is required.");
    }

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).send("Poll not found.");
    }
    if (poll.isClosed || (poll.expiresAt && poll.expiresAt < new Date())) {
      return res.status(400).send("Voting for this poll has ended.");
    }
    if (optionIndex >= poll.options.length) {
      return res.status(400).send("Invalid option index provided.");
    }

    const userAlreadyVoted = poll.options.some((option) =>
      option.votes.includes(userId)
    );

    if (userAlreadyVoted && !poll.allowMultipleVotes) {
      return res
        .status(400)
        .send(
          "You have already voted on this poll and multiple votes are not allowed."
        );
    }

    // Remove existing vote(s) if not allowing multiple votes (to change vote)
    if (!poll.allowMultipleVotes) {
      poll.options.forEach((option) => {
        option.votes = option.votes.filter(
          (voterId) => voterId.toString() !== userId.toString()
        );
      });
    }

    // Add new vote
    poll.options[optionIndex].votes.push(userId);
    await poll.save();

    // You would likely emit updated poll data via Socket.IO
    // io.to(poll.channel || poll.sender).to(poll.recipient).emit('pollUpdated', poll);

    return res.status(200).json({ message: "Vote cast successfully.", poll });
  } catch (error) {
    return sendErrorResponse(res, error, "Error casting vote.");
  }
};

// Get poll details (including results)
export const getPollDetails = async (req, res) => {
  try {
    const { pollId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(pollId)) {
      return res.status(400).send("Invalid poll ID format.");
    }

    const poll = await Poll.findById(pollId)
      .populate("creator", "firstName lastName image")
      .populate("options.votes", "firstName lastName image"); // Populate who voted

    if (!poll) {
      return res.status(404).send("Poll not found.");
    }

    // Basic access control: Only creator, channel members, or DM participants can view
    let hasAccess = false;
    if (poll.creator.toString() === userId.toString()) {
      hasAccess = true;
    } else if (poll.channel) {
      const channel = await Channel.findById(poll.channel);
      if (
        channel &&
        (channel.members.includes(userId) ||
          channel.admin.toString() === userId.toString())
      ) {
        hasAccess = true;
      }
    } else if (poll.sender && poll.recipient) {
      if (
        poll.sender.toString() === userId.toString() ||
        poll.recipient.toString() === userId.toString()
      ) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res.status(403).send("You are not authorized to view this poll.");
    }

    return res.status(200).json({ poll });
  } catch (error) {
    return sendErrorResponse(res, error, "Error fetching poll details.");
  }
};

// Close a poll (prevent further voting)
export const closePoll = async (req, res) => {
  try {
    const { pollId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(pollId)) {
      return res.status(400).send("Invalid poll ID format.");
    }

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).send("Poll not found.");
    }

    // Only the creator can close the poll
    if (poll.creator.toString() !== userId.toString()) {
      return res.status(403).send("Only the poll creator can close this poll.");
    }
    if (poll.isClosed) {
      return res.status(200).send("Poll is already closed.");
    }

    poll.isClosed = true;
    await poll.save();

    // You might emit a pollClosed event via Socket.IO
    // io.to(poll.channel || poll.sender).to(poll.recipient).emit('pollClosed', poll);

    return res.status(200).json({ message: "Poll closed successfully.", poll });
  } catch (error) {
    return sendErrorResponse(res, error, "Error closing poll.");
  }
};

// Delete a poll
export const deletePoll = async (req, res) => {
  try {
    const { pollId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(pollId)) {
      return res.status(400).send("Invalid poll ID format.");
    }

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).send("Poll not found.");
    }

    // Only the creator or an admin can delete the poll
    const user = await User.findById(userId); // Assuming 'role' field exists
    if (
      poll.creator.toString() !== userId.toString() &&
      (!user || user.role !== "admin")
    ) {
      return res
        .status(403)
        .send("Only the poll creator or an admin can delete this poll.");
    }

    await poll.deleteOne();

    // You might emit a pollDeleted event via Socket.IO
    // io.to(poll.channel || poll.sender).to(poll.recipient).emit('pollDeleted', { pollId });

    return res.status(200).send("Poll deleted successfully.");
  } catch (error) {
    return sendErrorResponse(res, error, "Error deleting poll.");
  }
};