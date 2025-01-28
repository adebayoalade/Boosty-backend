const express = require("express");
const {createClerkClient} = require('@clerk/backend');
const {verifyTokenAndAdmin, verifyTokenAndAuthorization} = require("../middleware/verifyToken");
const User = require("../models/User");
const CryptoJS = require("crypto-js");
const limiter = require("../middleware/limiter")

const router = express.Router();

// Initialize Clerk
const clerk = createClerkClient({
    apiKey: process.env.CLERK_SECRET_KEY,
});

// Input validation helpers
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const validatePassword = (password) => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
};

// Forget password
router.post("/forget-password", limiter, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !validateEmail(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            // Return same message even if user not found to prevent email enumeration
            return res.status(200).json({
                message: "If a user with this email exists, a password reset link has been sent"
            });
        }

        await clerk.passwords.createPasswordReset({
            emailAddress: email
        });

        res.status(200).json({
            message: "If a user with this email exists, a password reset link has been sent"
        });
    } catch (error) {
        console.error('Password reset request error:', error);
        res.status(500).json({ error: "Unable to process password reset request" });
    }
});

// Reset Password
router.post("/reset-password", limiter, async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!password || !validatePassword(password)) {
            return res.status(400).json({
                error: "Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character"
            });
        }

        const resetResult = await clerk.passwords.resetPassword({
            token,
            password
        });

        const user = await User.findOne({ email: resetResult.emailAddress });
        if (user) {
            const encryptedPassword = CryptoJS.AES.encrypt(
                password,
                process.env.PASS_SEC
            ).toString();
            user.password = encryptedPassword;
            await user.save();
        }

        res.status(200).json({ message: "Password reset successful" });
    } catch (error) {
        res.status(500).json({ error: "Unable to reset password" });
    }
});

// Update user
router.put("/:id", verifyTokenAndAuthorization, async(req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const updates = { ...req.body };

        // Handle password update
        if (updates.password) {
            if (!validatePassword(updates.password)) {
                return res.status(400).json({
                    error: "Invalid password format"
                });
            }
            updates.password = CryptoJS.AES.encrypt(
                updates.password,
                process.env.PASS_SEC
            ).toString();
            
            await clerk.users.updateUser(user.clerkId, {
                password: req.body.password
            });
        }

        // Handle email update
        if (updates.email) {
            if (!validateEmail(updates.email)) {
                return res.status(400).json({ error: "Invalid email format" });
            }
            const existingUser = await User.findOne({ email: updates.email });
            if (existingUser && existingUser._id.toString() !== req.params.id) {
                return res.status(400).json({ error: "Email already in use" });
            }
            await clerk.users.updateUser(user.clerkId, {
                emailAddress: [updates.email]
            });
        }

        // Handle username update
        if (updates.username) {
            await clerk.users.updateUser(user.clerkId, {
                username: updates.username
            });
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        const { password, ...userWithoutPassword } = updatedUser._doc;
        res.status(200).json(userWithoutPassword);
    } catch (error) {
        console.error('Update error:', error);
        res.status(500).json({ error: "Unable to update user" });
    }
});

// Delete user
router.delete("/:id", verifyTokenAndAuthorization, async(req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        await clerk.users.deleteUser(user.clerkId);
        await User.findByIdAndDelete(req.params.id);

        res.status(200).json({ message: "User successfully deleted" });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: "Unable to delete user" });
    }
});

// Get single user
router.get("/find/:id", verifyTokenAndAdmin, async(req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const { password, ...userWithoutPassword } = user._doc;
        res.status(200).json(userWithoutPassword);
    } catch (error) {
        console.error('Find user error:', error);
        res.status(500).json({ error: "Unable to retrieve user" });
    }
});

// Get all users with pagination
router.get("/", verifyTokenAndAdmin, async(req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const users = await User.find()
            .select('-password')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await User.countDocuments();

        res.status(200).json({
            users,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalUsers: total
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: "Unable to retrieve users" });
    }
});

// Get user stats with caching
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

router.get("/stats", verifyTokenAndAdmin, async(req, res) => {
    try {
        const cacheKey = 'user_stats';
        const cachedData = cache.get(cacheKey);
        
        if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
            return res.status(200).json(cachedData.data);
        }

        const date = new Date();
        const pastYear = new Date(date.setFullYear(date.getFullYear() - 1));

        const data = await User.aggregate([
            { $match: { createdAt: { $gte: pastYear } } },
            {
                $project: {
                    month: { $month: "$createdAt" },
                    year: { $year: "$createdAt" }
                },
            },
            {
                $group: {
                    _id: {
                        month: "$month",
                        year: "$year"
                    },
                    total: { $sum: 1 },
                },
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        cache.set(cacheKey, {
            timestamp: Date.now(),
            data: data
        });

        res.status(200).json(data);
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: "Unable to retrieve user statistics" });
    }
});

module.exports = router;