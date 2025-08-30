import User from "../models/UserModel.js";
import Friendship from "../models/FriendShipModel.js";
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from "../middleware/errorHandler.js";

let io;

export const setFriendControllerIo = (ioInstance) => {
  io = ioInstance;
  // console.log('Socket.IO instance set in FriendController.'); // For debugging
};

// Helper function to check if users exist and pass error
const checkUsersExist = async (userIds, next) => {
  try {
    const users = await User.find({ _id: { $in: userIds } });
    if (users.length !== userIds.length) {
      const foundIds = users.map((user) => user._id.toString());
      const missingIds = userIds.filter((id) => !foundIds.includes(id));
      return next(
        new NotFoundError(
          `User(s) with ID(s) ${missingIds.join(", ")} not found.`
        )
      );
    }
    return users;
  } catch (error) {
    next(error);
    return null;
  }
};

// @desc    Send a friend request
// @route   POST /api/v1/friends/request
// @access  Private (Auth protected)
export const sendFriendRequest = async (req, res, next) => {
  try {
    const senderId = req.user.id;
    const { recipientId } = req.body;

    if (senderId === recipientId) {
      return next(
        new BadRequestError("You cannot send a friend request to yourself.")
      );
    }

    const recipientUser = await checkUsersExist([recipientId], next);
    if (!recipientUser) return;

    const existingFriendship = await Friendship.findOne({
      $or: [
        { sender: senderId, recipient: recipientId },
        { sender: recipientId, recipient: senderId },
      ],
    });

    if (existingFriendship) {
      if (existingFriendship.status === "pending") {
        if (existingFriendship.sender.toString() === recipientId) {
          return next(
            new ConflictError(
              "You have a pending friend request from this user. Accept it instead."
            )
          );
        }
        return next(
          new ConflictError("Friend request already sent to this user.")
        );
      }
      if (existingFriendship.status === "accepted") {
        return next(
          new ConflictError("You are already friends with this user.")
        );
      }
      if (
        existingFriendship.status === "rejected" ||
        existingFriendship.status === "cancelled"
      ) {
        return next(
          new ConflictError(
            `Previous friend request was ${existingFriendship.status}. Cannot send another at this time.`
          )
        );
      }
    }

    const newFriendship = await Friendship.create({
      sender: senderId,
      recipient: recipientId,
      status: "pending",
    });

    // Optional: Emit a Socket.IO event to the recipient (and ideally also persist as a notification)
    if (io) {
      // Emit event to recipient's specific room
      io.to(recipientId).emit("friendRequestReceived", {
        senderId: senderId,
        senderName: req.user.name, // Assuming req.user has name
        requestId: newFriendship._id,
      });

      // Also trigger a server-side socket event for persistent notification
      io.emit("friendRequestNotification", {
        senderId: senderId,
        recipientId: recipientId,
        requestId: newFriendship._id,
        senderName: req.user.name,
      });
    }

    res.status(201).json({
      status: "success",
      message: "Friend request sent successfully.",
      data: {
        friendship: newFriendship,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Accept a friend request
// @route   PATCH /api/v1/friends/request/accept/:id
// @access  Private (Auth protected)
export const acceptFriendRequest = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const requestId = req.params.id;

    const friendship = await Friendship.findById(requestId);

    if (!friendship) {
      return next(new NotFoundError("Friend request not found."));
    }

    if (friendship.recipient.toString() !== currentUserId) {
      return next(
        new ForbiddenError("You are not authorized to accept this request.")
      );
    }

    if (friendship.status !== "pending") {
      return next(
        new BadRequestError(
          `Friend request is not pending (current status: ${friendship.status}).`
        )
      );
    }

    friendship.status = "accepted";
    await friendship.save();

    // Optional: Emit Socket.IO events to both users (and persist notifications)
    if (io) {
      // Notify the sender that their request was accepted
      io.to(friendship.sender.toString()).emit("friendRequestAccepted", {
        friendshipId: friendship._id,
        accepterId: currentUserId,
        accepterName: req.user.name,
      });
      // Also trigger a server-side socket event for persistent notification
      io.emit("friendRequestAcceptedNotification", {
        acceptorId: currentUserId,
        acceptedId: friendship.sender.toString(), // The ID of the person whose request was accepted
        friendshipId: friendship._id,
        accepterName: req.user.name,
      });

      // Optionally, notify the recipient (accepter) that friendship is established
      io.to(friendship.recipient.toString()).emit("friendshipEstablished", {
        friendshipId: friendship._id,
        friendId: friendship.sender.toString(),
      });
    }

    res.status(200).json({
      status: "success",
      message: "Friend request accepted.",
      data: {
        friendship,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject a friend request
// @route   PATCH /api/v1/friends/request/reject/:id
// @access  Private (Auth protected)
export const rejectFriendRequest = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const requestId = req.params.id;

    const friendship = await Friendship.findById(requestId);

    if (!friendship) {
      return next(new NotFoundError("Friend request not found."));
    }

    if (friendship.recipient.toString() !== currentUserId) {
      return next(
        new ForbiddenError("You are not authorized to reject this request.")
      );
    }

    if (friendship.status !== "pending") {
      return next(
        new BadRequestError(
          `Friend request is not pending (current status: ${friendship.status}).`
        )
      );
    }

    friendship.status = "rejected";
    await friendship.save();

    // Optional: Emit a Socket.IO event to the sender (and persist notification)
    if (io) {
      io.to(friendship.sender.toString()).emit("friendRequestRejected", {
        friendshipId: friendship._id,
        rejecterId: currentUserId,
        rejecterName: req.user.name,
      });
      // You'd also want to persist this notification
      io.emit("friendRequestRejectedNotification", {
        rejecterId: currentUserId,
        rejectedId: friendship.sender.toString(),
        friendshipId: friendship._id,
        rejecterName: req.user.name,
      });
    }

    res.status(200).json({
      status: "success",
      message: "Friend request rejected.",
      data: {
        friendship,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel an outgoing friend request
// @route   PATCH /api/v1/friends/request/cancel/:id
// @access  Private (Auth protected)
export const cancelFriendRequest = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const requestId = req.params.id;

    const friendship = await Friendship.findById(requestId);

    if (!friendship) {
      return next(new NotFoundError("Friend request not found."));
    }

    if (friendship.sender.toString() !== currentUserId) {
      return next(
        new ForbiddenError("You are not authorized to cancel this request.")
      );
    }

    if (friendship.status !== "pending") {
      return next(
        new BadRequestError(
          `Friend request is not pending (current status: ${friendship.status}).`
        )
      );
    }

    friendship.status = "cancelled";
    await friendship.save();

    // Optional: Emit a Socket.IO event to the recipient (and persist notification)
    if (io) {
      io.to(friendship.recipient.toString()).emit("friendRequestCancelled", {
        friendshipId: friendship._id,
        cancellerId: currentUserId,
        cancellerName: req.user.name,
      });
      // You'd also want to persist this notification
      io.emit("friendRequestCancelledNotification", {
        cancellerId: currentUserId,
        cancelledId: friendship.recipient.toString(),
        friendshipId: friendship._id,
        cancellerName: req.user.name,
      });
    }

    res.status(200).json({
      status: "success",
      message: "Friend request cancelled.",
      data: {
        friendship,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all friend requests (incoming and outgoing pending)
// @route   GET /api/v1/friends/requests
// @access  Private (Auth protected)
export const getFriendRequests = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const incomingRequests = await Friendship.find({
      recipient: userId,
      status: "pending",
    }).populate("sender", "name email");

    const outgoingRequests = await Friendship.find({
      sender: userId,
      status: "pending",
    }).populate("recipient", "name email");

    res.status(200).json({
      status: "success",
      data: {
        incoming: incomingRequests,
        outgoing: outgoingRequests,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user's friends list
// @route   GET /api/v1/friends/list
// @access  Private (Auth protected)
export const getFriendsList = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const friends = await Friendship.find({
      $or: [
        { sender: userId, status: "accepted" },
        { recipient: userId, status: "accepted" },
      ],
    })
      .populate("sender", "name email")
      .populate("recipient", "name email");

    const friendsList = friends.map((friendship) => {
      if (friendship.sender._id.toString() === userId) {
        return friendship.recipient;
      } else {
        return friendship.sender;
      }
    });

    res.status(200).json({
      status: "success",
      results: friendsList.length,
      data: {
        friends: friendsList,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unfriend a user
// @route   DELETE /api/v1/friends/unfriend/:id (id is the friend's user ID)
// @access  Private (Auth protected)
export const unfriend = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const friendUserId = req.params.id;

    if (currentUserId === friendUserId) {
      return next(new BadRequestError("You cannot unfriend yourself."));
    }

    const friendship = await Friendship.findOne({
      $or: [
        { sender: currentUserId, recipient: friendUserId, status: "accepted" },
        { sender: friendUserId, recipient: currentUserId, status: "accepted" },
      ],
    });

    if (!friendship) {
      return next(
        new NotFoundError(
          "You are not friends with this user or no active friendship found."
        )
      );
    }

    await Friendship.findByIdAndDelete(friendship._id);

    // Optional: Emit Socket.IO event to the unfriended user (and persist notification)
    if (io) {
      const unfriendedPartyId =
        friendship.sender.toString() === currentUserId
          ? friendship.recipient.toString()
          : friendship.sender.toString();
      io.to(unfriendedPartyId).emit("friendshipRemoved", {
        friendshipId: friendship._id,
        unfriendedById: currentUserId,
        unfriendedByName: req.user.name,
      });
      // You'd also want to persist this notification
      io.emit("friendshipRemovedNotification", {
        unfriendedById: currentUserId,
        unfriendedPartyId: unfriendedPartyId,
        friendshipId: friendship._id,
        unfriendedByName: req.user.name,
      });
    }

    res.status(204).json({
      status: "success",
      data: null,
      message: "User unfriended successfully.",
    });
  } catch (error) {
    next(error);
  }
};