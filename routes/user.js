const express = require("express");
const {verifyToken, verifyTokenAndAdmin, verifyTokenAndAuthorization,} = require("../middleware/verifyToken");
const User = require("../models/User");
const CryptoJS = require("crypto-js");

const router = express.Router();


//Update user
router.put("/:id", verifyTokenAndAuthorization, async(req, res) => {
//Confirming user password as another layer of the security, check user password for situation where the has changed it
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

//Forget Password
router.post("/forget", async(req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            return res.status(404).json("User not found!");
        }

        // Generate reset token
        const resetToken = Math.random().toString(36).slice(-12);
        const tokenExpiry = Date.now() + 1800000; // Token valid for 30 min

        // Update user with reset token
        await User.findByIdAndUpdate(
            user._id,
            {
                $set: { 
                    resetPasswordToken: resetToken,
                    resetPasswordExpire: tokenExpiry 
                },
            },
            { new: true }
        );

        // In real application, send email with reset link
        // For demo, just sending token in response
        res.status(200).json({
            message: "Password reset link has been generated",
            resetToken: resetToken
        });
    } catch (error) {
        res.status(500).json(error);
    }
});

//Reset Password
router.post("/reset/:token", async(req, res) => {
    try {
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json("Invalid or expired reset token");
        }

        // Encrypt new password
        const encryptedPassword = CryptoJS.AES.encrypt(
            req.body.newPassword,
            process.env.PASS_SEC
        ).toString();

        // Update user with new password
        await User.findByIdAndUpdate(
            user._id,
            {
                $set: { 
                    password: encryptedPassword,
                    resetPasswordToken: undefined,
                    resetPasswordExpire: undefined
                },
            },
            { new: true }
        );

        res.status(200).json({
            message: "Password has been reset successfully"
        });
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