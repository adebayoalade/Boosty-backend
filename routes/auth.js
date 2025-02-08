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

const validateInputs = (email, username, password) => {
  return validateEmail(email) && validateUsername(username) && validatePassword(password);
};

const handleError = (res, error) => {
  console.error('Error:', error);
  if (error.code === 11000) {
    return res.status(400).json({ message: "Username or email already exists" });
  }
  res.status(500).json({ 
    message: error.message || "Registration failed",
    details: process.env.NODE_ENV === 'development' ? error : undefined
  });
};

//register
router.post("/register", async (req, res) => {
  try {
    let { emailAddress, username, password } = req.body;
    const email = Array.isArray(emailAddress) ? emailAddress[0] : emailAddress;

    if (!validateInputs(email, username, password)) {
      return res.status(400).json({ message: "Invalid input format" });
    }

    // Create user in Clerk with explicit email verification settings
    const clerkUser = await clerk.users.createUser({
      emailAddress: [email],
      username,
      password,
      verifications: {
        emailAddress: {
          strategy: "email_code"
        }
      }
    });

    const newUser = new User({
      clerkId: clerkUser.id,
      username,
      email,
      isVerified: false,
    });

    await newUser.save();

    res.status(201).json({
      message: "Registration successful! Please check your email for a verification code.",
      instructions: [
        "Use that code along with your userId to verify your email"
      ],
      userId: clerkUser.id,
      email: email
    });

  } catch (error) {
    handleError(res, error);
  }
});


// Verify Email Route
router.post("/verify-email", limiter, async (req, res) => {
  try {
    const { code, userId } = req.body;

    if (!code || !userId) {
      return res.status(400).json({ error: "Verification code and userId are required" });
    }

    const verification = await clerk.users.request('POST', `/users/${userId}/verify_email_address`, {
      code: code
    });

    if (verification.verified) {
      const user = await User.findOne({ clerkId: userId });
      if (user) {
        user.isVerified = true;
        await user.save();
      }
      return res.status(200).json({ message: "Email verified successfully", verified: true });
    }

    res.status(400).json({ message: "Verification failed", verified: false });

  } catch (error) {
    res.status(500).json({ message: "Verification failed", error: error.message });
  }
});



// Login Route
router.post("/login", limiter, async (req, res) => {
  try {
    const { username, password } = req.body;
 
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }
 
    // Find user in Clerk
    const clerkUsers = await clerk.users.request('GET', '/users', {
      username: username
    });
 
    const clerkUser = clerkUsers[0];
    if (!clerkUser) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
 
    // Verify password
    const signInAttempt = await clerk.users.request('POST', `/users/${clerkUser.id}/verify_password`, {
      password: password
    });
 
    if (!signInAttempt.valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
 
    // Check email verification
    const primaryEmail = clerkUser.emailAddresses.find(email => email.id === clerkUser.primaryEmailAddressId);
    if (!primaryEmail.verified) {
      return res.status(403).json({ 
        message: "Please verify your email before logging in",
        requiresEmailVerification: true,
        userId: clerkUser.id
      });
    }
 
    // Find user in database
    const user = await User.findOne({ clerkId: clerkUser.id });
    if (!user) {
      return res.status(401).json({ message: "User not found in database" });
    }
 
    // Generate tokens
    const accessToken = jwt.sign(
      { id: user._id, isAdmin: user.isAdmin },
      process.env.JWT_SEC,
      { expiresIn: "15m" }
    );
 
    const refreshToken = jwt.sign(
      { id: user._id, isAdmin: user.isAdmin },
      process.env.JWT_REFRESH_SEC,
      { expiresIn: "1d" }
    );
 
    // Update refresh token
    await User.findByIdAndUpdate(user._id, { refreshToken });
 
    // Return user data and tokens
    const { password: userPassword, refreshToken: storedRefreshToken, ...others } = user._doc;
    res.status(200).json({ 
      ...others, 
      accessToken,
      verified: true
    });
 
  } catch (error) {
    res.status(500).json({ 
      message: "Login failed", 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
 });



module.exports = router;
