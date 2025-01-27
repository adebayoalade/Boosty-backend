const express = require("express");
const router = express.Router();
const { createClerkClient } = require("@clerk/backend");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const APIKEY = process.env.CLERK_SECRET_KEY;

// Register
router.post("/register", async (req, res) => {

  try {
    // Validate input
    if (!req.body.emailAddress || !req.body.username || !req.body.password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const clerk = createClerkClient({
      secretKey: APIKEY,
    });

    // Create user in Clerk
    const clerkUser = await clerk.users.createUser({
      emailAddress: req.body.emailAddress,
      username: req.body.username,
      password: req.body.password,
    });

    // Create user in our database
    const newUser = new User({
      clerkId: clerkUser.id,
      username: req.body.username,
      email: req.body.emailAddress[0],
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
       secretKey: APIKEY
    });

    // Verify credentials with Clerk
    const signInAttempt = await clerk.signIn.create({
      identifier: req.body.username,
      password: req.body.password
    });

    if (signInAttempt.status !== "complete") {
      return res.status(401).json("Invalid credentials");
    }

    // Find user in our database
    const user = await User.findOne({
      username: req.body.username
    });
    
    if (!user) {
      return res.status(401).json("User not found");
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

    const { password, ...others } = user._doc;

    // Store refresh token
    await User.findByIdAndUpdate(user._id, { refreshToken });

    // Respond with the user data and tokens
    res.status(200).json({ ...others, accessToken, refreshToken });

  } catch (error) {
    // Handle errors based on Clerk's response
    if (error?.response?.data?.message) {
      return res.status(401).json(error.response.data.message);
    }
    res.status(500).json({ message: "Login failed" });
  }
});



module.exports = router;