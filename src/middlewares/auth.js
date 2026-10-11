const jwt = require("jsonwebtoken");
const User = require("../models/user");

const userAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).send("Please Login!");
    }

    let decodedObj;

    try {
      decodedObj = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.error("JWT verification failed:", err.name, err.message);
      return res.status(401).send("Session expired or invalid. Please login again.");
    }

    const user = await User.findById(decodedObj._id);

    if (!user) {
      console.error("Authentication failed: user not found in database");
      return res.status(401).send("User not found. Please login again.");
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("userAuth middleware error:", err);
    return res.status(500).send("Authentication server error");
  }
};

module.exports = { userAuth };
