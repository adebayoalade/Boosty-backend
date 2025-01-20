const mongoose = require("mongoose");

const Itemschema = new mongoose.Schema(
    {
        type: {
            type: String,
            required: true,
            enum: ['business', 'home'],
        },
        address: {
            type: String,
            required: true,
        },
        budget: {
            type: Number,
            required: true,
        },
    },
    {timestamps: true}
);


module.exports = mongoose.model("Item", Itemschema);