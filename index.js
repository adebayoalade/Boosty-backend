const express = require("express");
const app = express();
const mongoose = require("mongoose");
const dotenv = require("dotenv");


// use the exported router
const userRoute = require("./routes/user");
const authRoute = require("./routes/auth");

dotenv.config();


// connect our code to the database (MongoDB)
mongoose
.connect(process.env.MONGO_URL)
.then(() => console.log("DB Connection Established"))
.catch((err) => console.log(err));

//Use the route
app.use("/api/users", userRoute);
app.use("/api/auth", authRoute);


// to listen to the application
app.listen(process.env.PORT || 3001, () => {
    console.log("Backend services is running");
    });
