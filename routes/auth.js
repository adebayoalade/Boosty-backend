const express = require("express");
const router = express.Router();
const { createClerkClient } = require("@clerk/backend");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

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

// Register
router.post("/register", async (req, res) => {
  try {
    const { emailAddress, username, password } = req.body;

    // Validate input
    if (!emailAddress || !username || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Validate email format
    if (!validateEmail(emailAddress)) {
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
        message: "Password must contain at least 8 characters, including uppercase, lowercase, number and special character" 
      });
    }

    // Create user in Clerk
    const clerkUser = await clerk.users.createUser({
      emailAddress,
      username,
      password,
    });

    // Create user in our database
    const newUser = new User({
      clerkId: clerkUser.id,
      username,
      email: emailAddress[0],
    });

    await newUser.save();

    res.status(201).json({
      message: "registeration successful",
      userId: newUser._id,
    });
  } catch (error) {
    //MongoDB duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ message: "Username or email already exists" });
    }
    res.status(500).json({ message: "Registration failed" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    // First find the user in our database to get their Clerk ID
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(401).json("User does not exist");
    }

    try {
      // Use Clerk's backend API to verify the password
      await clerk.users.verifyPassword({
        userId: user.clerkId,
        password: password
      });
    } catch (error) {
      return res.status(401).json("Invalid credentials");
    }

    // If we get here, password is verified
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

    const { password: userPassword, ...others } = user._doc;

    // Store refresh token
    await User.findByIdAndUpdate(user._id, { refreshToken });

    // Respond with the user data and tokens
    res.status(200).json({ ...others, accessToken, refreshToken });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: "Login failed" });
  }
});


module.exports = router;