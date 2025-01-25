const express = require("express");
const router = express.Router();
const { createClerkClient } = require("@clerk/backend");
const cryptoJS = require("crypto-js");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Register
router.post("/register", async (req, res) => {
  try {
    // Validate input
    if (!req.body.email || !req.body.username || !req.body.password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { email: req.body.email },
        { username: req.body.username }
      ]
    });

    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    const clerkUser = await clerk.users.createUser({
      emailAddress: [req.body.email],
      username: req.body.username,
      password: req.body.password,
    });

    const newUser = new User({
      clerkId: clerkUser.id,
      username: req.body.username,
      email: req.body.email,
      password: cryptoJS.AES.encrypt(
        req.body.password,
        process.env.PASS_SEC
      ).toString(),
      isVerified: true,
    });

    await newUser.save();

    res.status(201).json({
      message: "User registered successfully",
      userId: newUser._id,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Registration failed" });
  }
});



// Login
router.post("/login", async (req, res) => {
  try {
    const clerk = createClerkClient({
       secretKey: process.env.CLERK_SECRET_KEY
    });

    // First, attempt to find a user by username
    const user = await User.findOne({
      username: req.body.username
    });
    
    if (!user) {
      return res.status(401).json("User not found");
    }

    // Verify credentials with Clerk using email
    try {
      const clerkUser = await clerk.users.verifyPassword({
        email: user.email,
        password: req.body.password
      });

      if (!clerkUser) {
        return res.status(401).json("Invalid credentials");
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
        { expiresIn: "7d" }
      );
    
      const { password, ...others } = user._doc;
    
      // Store refresh token
      await User.findByIdAndUpdate(user._id, { refreshToken });

      res.status(200).json({ ...others, accessToken, refreshToken });

    } catch (clerkError) {
      return res.status(401).json("Invalid credentials");
    }

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: "Login failed" });
  }
});




module.exports = router;
