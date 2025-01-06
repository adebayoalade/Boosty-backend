const express = require("express");
const router = express.Router();

const cryptoJS = require("crypto-js");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { verifyToken } = require("../middleware/verifyToken");


//register
router.post("/register", async(req, res) => {
    const newUser = new User({
        username: req.body.username,
        email: req.body.email,
        password: cryptoJS.AES.encrypt(
            req.body.password,
            process.env.PASS_SEC,
        ).toString(),
    });
    try {
        const savedUser = await newUser.save();
        res.status(201).json(savedUser);
        } catch (error) {
        res.status(500).json(error);
    }
});

//Login
router.post("/login", async (req, res) => {
    try {
      const user = await User.findOne({
        username: req.body.username,
      });
  
      !user && res.status(401).json("Wrong Username");
  
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
          expiresIn: "3d",
        }
      );
  
      const { password, ...others } = user._doc;
  
      res.status(200).json({ ...others, accessToken });
    } catch (error) {
      res.status(500).json(error);
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