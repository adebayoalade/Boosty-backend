const mongoose = require("mongoose");

// User Schema

const OrderSchema = new mongoose.Schema(
  {
    itemId: {
      type: String,
      required: true,
    },
    items: [
      {
        itemId: {
          type: String,
        },
        quantity: {
          type: Number,
          default: 1,
        },
      },
    ],
    amount: {
      type: Number,
      required: true,
    },
    address: {
      type: Object,
      required: true,
    },
    status: {
      type: String,
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema);