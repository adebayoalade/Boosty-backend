const express = require("express");
const router = express.Router();
const { createClerkClient } = require("@clerk/backend");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const limiter = require("../middleware/limiter");

const APIKEY = process.env.CLERK_SECRET_KEY;

const clerk = createClerkClient({
  secretKey: APIKEY,
});

// Validation helpers
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

const validateUsername = (username) => {
  return username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9_]+$/.test(username);
};

// Register Route
router.post("/register", async (req, res) => {
  try {
    let { emailAddress, username, password } = req.body;

    // Ensure emailAddress is a string if it's an array
    const email = Array.isArray(emailAddress) ? emailAddress[0] : emailAddress;

    // Validate input
    if (!email || !username || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Validate username format
    if (!validateUsername(username)) {
      return res.status(400).json({ 
        message: "Username must be 3-20 characters long and contain only letters, numbers, and underscores" 
      });
    }

    // Validate password strength
    if (!validatePassword(password)) {
      return res.status(400).json({ 
        message: "Password must contain at least 8 characters, including uppercase, lowercase, number, and special character" 
      });
    }

    // Create user in Clerk
    const clerkUser = await clerk.users.createUser({
      emailAddress: [email], // Ensures Clerk gets an array
      username,
      password,
    });

    // Create user in our database
    const newUser = new User({
      clerkId: clerkUser.id,
      username,
      email,
    });

    await newUser.save();

    res.status(201).json({
      message: "Registration successful",
      userId: newUser._id,
    });

  } catch (error) {
    // MongoDB duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ message: "Username or email already exists" });
    }
    res.status(500).json({ message: "Registration failed" });
  }
});

// Login Route
router.post("/login", limiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    // Verify credentials with Clerk
    const signInAttempt = await clerk.signIn.create({
      identifier: username,
      password,
    });

    if (signInAttempt.status !== "complete") {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Find user in our database
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(401).json({ message: "User does not exist" });
    }

    // Generate tokens
    const accessToken = jwt.sign(
      {
        id: user._id,
        isAdmin: user.isAdmin,
      },
      process.env.JWT_SEC,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      {
        id: user._id,
        isAdmin: user.isAdmin,
      },
      process.env.JWT_REFRESH_SEC,
      { expiresIn: "1d" }
    );

    // Store refresh token
    await User.findByIdAndUpdate(user._id, { refreshToken });

    // Respond with the user data and tokens
    const { password: userPassword, refreshToken: storedRefreshToken, ...others } = user._doc;
    res.status(200).json({ ...others, accessToken });

  } catch (error) {
    res.status(500).json({ message: "Login failed" });
  }
});

module.exports = router;
