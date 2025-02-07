const express = require("express");
const {createClerkClient} = require('@clerk/backend');
const {verifyTokenAndAdmin, verifyTokenAndAuthorization} = require("../middleware/verifyToken");
const User = require("../models/User");
const CryptoJS = require("crypto-js");
const limiter = require("../middleware/limiter")

const router = express.Router();

// Initialize Clerk
const clerk = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
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
            return res.status(200).json({
                message: "If a user with this email exists, a password reset link has been sent"
            });
        }

        //request method 
        await clerk.users.request('POST', '/password_reset', {
            email_address: email
        });

        res.status(200).json({
            message: "If a user with this email exists, a password reset link has been sent"
        });
    } catch (error) {
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

        const resetResult = await clerk.users.request('POST', '/password_reset/attempt', {
            token,
            password
        });

        if (resetResult.status === 'completed') {
            return res.status(200).json({ message: "Password reset successful" });
        }

        res.status(400).json({ error: "Password reset failed" });
    } catch (error) {
        res.status(500).json({ error: "Unable to reset password" });
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
        res.status(500).json({ error: "Unable to retrieve user statistics" });
    }
});

module.exports = router;