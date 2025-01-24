const express = require("express");
const cors = require("cors");
const app = express();
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const clerk = require('@clerk/express');


// use the exported router
const userRoute = require("./routes/user");
const authRoute = require("./routes/auth");
const setupRoute = require("./routes/setup");
const itemRoute = require("./routes/item");
const paystackRoute = require("./routes/paystack");
const orderRoute = require("./routes/order");


dotenv.config();


// connect our code to the database (MongoDB)
mongoose
.connect(process.env.MONGO_URL)
.then(() => console.log("DB Connection Established"))
.catch((err) => console.log(err));


app.use(cors());
//Use the route
app.use(express.json());
app.use(clerk.clerkMiddleware({ secretKey: process.env.CLERK_SECRET_KEY, publishableKey: process.env.CLERK_PUBLISHABLE_KEY }));

app.use("/api/users", userRoute);
app.use("/api/auth", authRoute);
app.use("/api/checkout", paystackRoute);
app.use("/api/setup", setupRoute);
app.use("/api/item", itemRoute);
app.use("/api/order", orderRoute);


// to listen to the application
app.listen(process.env.PORT || 3001, () => {
    console.log("Backend services is running");
});