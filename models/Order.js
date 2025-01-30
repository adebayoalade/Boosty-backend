const mongoose = require("mongoose");

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
    paymentReference: {
      type: String,
      unique: true,
      sparse: true
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema);