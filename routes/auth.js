const express = require("express");
const router = express.Router();
const clerk = require('@clerk/express');
const cryptoJS = require("crypto-js");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { verifyToken } = require("../middleware/verifyToken");

//register
router.post("/register", async(req, res) => {
  try {
      const existingUser = await User.findOne({ 
          $or: [
              { email: req.body.email },
              { username: req.body.username }
          ]
      });
  
      if (existingUser) {
          return res.status(400).json({ message: "Username or email already exists" });
      }
  
      const newUser = new User({
          username: req.body.username,
          email: req.body.email,
          password: cryptoJS.AES.encrypt(
              req.body.password,
              process.env.PASS_SEC,
          ).toString(),
          isVerified: false,
          otp: Math.floor(100000 + Math.random() * 900000),
          otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
      });
  
      try {
          await clerk.emails.send({
              from: 'verification@yourapp.com',
              to: req.body.email,
              subject: "Email Verification",
              htmlBody: `
                  <h2>Welcome ${req.body.username}!</h2>
                  <p>Your verification code is: <strong>${newUser.otp}</strong></p>
                  <p>This code will expire in 10 minutes.</p>
              `
          });
          const savedUser = await newUser.save();
          res.status(201).json({ message: "Please check your email for verification code", userId: savedUser._id });
      } catch (emailError) {
          console.error('Email sending error:', emailError);
          return res.status(500).json({ message: "Failed to send verification email", error: emailError.message });
      }
  } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: "Registration failed. Please try again." });
  }
});


// Verify OTP
router.post("/verify-email", async (req, res) => {
try {
    const { userId, otp } = req.body;
    const user = await User.findById(userId);

    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    if (user.otp !== parseInt(otp)) {
        return res.status(400).json({ message: "Invalid OTP" });
    }

    if (new Date() > user.otpExpiry) {
        return res.status(400).json({ message: "OTP has expired" });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    try {
        await clerk.emails.createEmail({
            fromEmailName: "welcome",
            to: user.email,
            subject: "Welcome to Your App",
            body: `
                <h2>Welcome ${user.username}!</h2>
                <p>Thank you for verifying your email.</p>
                <p>You can now login to your account.</p>
            `
        });
    } catch (emailError) {
        console.error('Welcome email sending error:', emailError);
    }

    res.status(200).json({ message: "Email verified successfully" });
} catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ message: "Verification failed. Please try again." });
}
});

// Login
router.post("/login", async (req, res) => {
try {
  const user = await User.findOne({
    username: req.body.username,
  });
  
  !user && res.status(401).json("Wrong Username");

  if (!user.isVerified) {
    return res.status(401).json("Please verify your email first");
  }
  
  const hashedPassword = cryptoJS.AES.decrypt(
    user.password,
    process.env.PASS_SEC,
  );
  
  const OriginalPassword = hashedPassword.toString(cryptoJS.enc.Utf8);
  
  OriginalPassword !== req.body.password &&
    res.status(401).json("Wrong Password");
  
  const accessToken = jwt.sign(
    {
      id: user._id,
      isAdmin: user.isAdmin,
    },
    process.env.JWT_SEC,
    {
      expiresIn: "15m",
    }
  );

  const refreshToken = jwt.sign(
    {
      id: user._id,
      isAdmin: user.isAdmin,
    },
    process.env.JWT_REFRESH_SEC,
    {
      expiresIn: "7d",
    }
  );
  
  const { password, ...others } = user._doc;
  
  // Store refresh token in user document
  await User.findByIdAndUpdate(user._id, { refreshToken });

  try {
      await clerk.emails.createEmail({
          fromEmailName: "security",
          to: user.email,
          subject: "New Login Detected",
          body: `
              <h2>Hello ${user.username}</h2>
              <p>We detected a new login to your account.</p>
              <p>If this wasn't you, please secure your account immediately.</p>
          `
      });
  } catch (emailError) {
      console.error('Login notification email sending error:', emailError);
  }
  
  res.status(200).json({ ...others, accessToken, refreshToken });
} catch (error) {
  console.error('Login error:', error);
  res.status(500).json({ message: "Login failed. Please try again." });
}
});

  
// Verify Token
router.get("/verify", verifyToken, async (req, res) => {
try {
const user = await User.findById(req.user.id);
if (!user) {
  return res.status(404).json({ message: "User not found" });
}

const { password, ...userData } = user._doc;

// You might want to generate a new token here to extend the session
const newToken = jwt.sign(
  { id: user._id, isAdmin: user.isAdmin },
  process.env.JWT_SEC,
  { expiresIn: "3d" }
);

res.status(200).json({
  user: userData,
  accessToken: newToken,
});
} catch (error) {
console.error("Error in verifying user's access from the backend:", error);
res.status(500).json({ message: "Internal server error" });
}
});

module.exports = router;