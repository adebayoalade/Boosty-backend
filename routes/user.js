const express = require("express");
const {createClerkClient} = require('@clerk/backend');
const {verifyTokenAndAdmin, verifyTokenAndAuthorization,} = require("../middleware/verifyToken");
const User = require("../models/User");
const CryptoJS = require("crypto-js");

const router = express.Router();

// Initialize Clerk
const clerk = createClerkClient({
    apiKey: process.env.CLERK_SECRET_KEY,
});

//forget password
router.post("/forget-password", async (req, res) => { 
    try {
        // Find user in your database
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Use Clerk to initiate password reset
        await clerk.passwords.createPasswordReset({
            emailAddress: req.body.email
        });

        res.status(200).json({ 
            message: "Password reset link sent to email" 
        });
    } catch (error) {
        console.error('Forget password error:', error);
        res.status(500).json({ error: "Error processing password reset" });
    }
});

// Reset Password Route
router.post("/reset-password", async (req, res) => {
    try {
        const { token, password } = req.body;

        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json({ error: "Password must be at least 8 characters" });
        }

        // Use Clerk to reset password
        const resetResult = await clerk.passwords.resetPassword({
            token,
            password
        });

        //Update encrypted password in your custom User model
        const user = await User.findOne({ email: resetResult.emailAddress });
        if (user) {
            user.password = CryptoJS.AES.encrypt(
                password,
                process.env.PASS_SEC
            ).toString();
            await user.save();
        }

        res.status(200).json({ message: "Password reset successful" });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: "Error resetting password" });
    }
});



//Update user
router.put("/:id", verifyTokenAndAuthorization, async(req, res) => {
if (req.body.password) {
    req.body.password =  CryptoJS.AES.encrypt(
        req.body.password,
        process.env.PASS_SEC,
    ).toString();
}
try {
    const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        {
            $set: req.body,
        },
        {new: true}
    );

    res.status(200).json(updatedUser);
} catch (error) {
    res.status(500).json(error);
}
});


//delete user
router.delete("/:id", verifyTokenAndAuthorization, async(req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.status(200).json({message: "User has been deleted"});
    } catch (error) {
        res.status(500).json(error);
    }
});

//Get single user
router.get("/find/:id", verifyTokenAndAdmin, async(req, res) => {
  try {
    const user = await User.findById(req.params.id);

    const {password, ...others} = user._doc;
    
    res.status(200).json(others);
  } catch (error) {
    res.status(500).json(error);
  }
});

//Get all user
router.get("/", verifyTokenAndAdmin, async(req, res) => {
    const query = req.query.new;
 try {
    const users = query?
    await User.find().sort({_id: -1 }).limit(5)
    : await User.find();

    res.status(200).json(users);
 } catch (error) {
    res.status(500).json(error);
 }
});


//Get user stats/ or onboarding stats
router.get("/stats", verifyTokenAndAdmin, async(req, res) => {
    const date = new Date();
    const pastYear = new Date(date.setFullYear(date.getFullYear() -1));
  try {
    const data = await User.aggregate([
        { $match: { createdAt: { $gte: pastYear } } },
      {
        $project: {
            month: { $month: "$createdAt" },
        },
      },
      {
        $group: {
            _id: "$month",
            total: { $sum: 1 },
            },
        },
    ]);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json(error);
  }
});


module.exports = router;