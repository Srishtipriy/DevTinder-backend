const express = require("express");
const mongoose = require("mongoose"); // MongoDB ObjectId ke liye
const userRouter = express.Router();

const { userAuth } = require("../middlewares/auth");
const ConnectionRequest = require("../models/connectionRequest");
const User = require("../models/user");

// Safe user data: sensitive information hide rahegi
const USER_SAFE_DATA =
  "firstName lastName photoUrl age gender about skills";

// Get all pending connection requests received by logged-in user
userRouter.get("/user/requests/received", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;

    const connectionRequests = await ConnectionRequest.find({
      toUserId: loggedInUser._id,
      status: "interested",
    }).populate("fromUserId", USER_SAFE_DATA);

    res.json({
      message: "Data fetched successfully",
      data: connectionRequests,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get all accepted connections of logged-in user
userRouter.get("/user/connections", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;

    const connectionRequests = await ConnectionRequest.find({
      $or: [
        { toUserId: loggedInUser._id, status: "accepted" },
        { fromUserId: loggedInUser._id, status: "accepted" },
      ],
    })
      .populate("fromUserId", USER_SAFE_DATA)
      .populate("toUserId", USER_SAFE_DATA);

    // Return the other user's profile from each accepted connection
    const data = connectionRequests
      .map((row) => {
        if (!row.fromUserId || !row.toUserId) {
          return null; // Deleted user ki wajah se error na aaye
        }

        if (
          row.fromUserId._id.toString() === loggedInUser._id.toString()
        ) {
          return row.toUserId;
        }

        return row.fromUserId;
      })
      .filter(Boolean);

    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get randomized feed and prioritize the opposite gender
userRouter.get("/feed", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;

    // Pagination values
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit) || 10)
    );
    const skip = (page - 1) * limit;

    // Determine the preferred gender
    const userGender = (loggedInUser.gender || "").toLowerCase();

    let oppositeGender = null;

    if (userGender === "female") {
      oppositeGender = "male";
    } else if (userGender === "male") {
      oppositeGender = "female";
    }

    // Find all users who have already exchanged a connection request
    const connectionRequests = await ConnectionRequest.find({
      $or: [
        { fromUserId: loggedInUser._id },
        { toUserId: loggedInUser._id },
      ],
    }).select("fromUserId toUserId");

    // Exclude the logged-in user and users with existing requests
    const excludedIds = new Set([loggedInUser._id.toString()]);

    connectionRequests.forEach((request) => {
      excludedIds.add(request.fromUserId.toString());
      excludedIds.add(request.toUserId.toString());
    });

    // Convert IDs into MongoDB ObjectIds
    const excludedObjectIds = Array.from(excludedIds).map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    // Get eligible users, prioritize opposite gender, and randomize order
    const users = await User.aggregate([
      {
        $match: {
          _id: { $nin: excludedObjectIds },
        },
      },
      {
        $addFields: {
          // Random score for every eligible user
          randomScore: { $rand: {} },

          // Mark the preferred gender
          genderPriority: {
            $cond: [
              {
                $eq: [
                  {
                    $toLower: {
                      $ifNull: ["$gender", ""],
                    },
                  },
                  oppositeGender || "__no_gender_match__",
                ],
              },
              0,
              1,
            ],
          },
        },
      },
      {
        $sort: {
          genderPriority: 1, // Preferred gender comes first
          randomScore: 1,    // Random order within each group
        },
      },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          photoUrl: 1,
          age: 1,
          gender: 1,
          about: 1,
          skills: 1,
        },
      },
    ]);

    res.json({ data: users });
  } catch (err) {
    console.error("Feed error:", err);
    res.status(400).json({ message: err.message });
  }
});

module.exports = userRouter;