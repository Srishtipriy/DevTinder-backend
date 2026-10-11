
const express = require("express");
const crypto = require("crypto");
const { userAuth } = require("../middlewares/auth");
const razorpayInstance = require("../utils/razorpay");
const Payment = require("../models/payment");
const User = require("../models/user");
const { membershipAmount } = require("../utils/constants");

const paymentRouter = express.Router();

// Create Razorpay order
paymentRouter.post("/payment/create", userAuth, async (req, res) => {
  try {
    const { membershipType } = req.body;

    if (!["silver", "gold"].includes(membershipType)) {
      return res.status(400).json({ msg: "Invalid membership type" });
    }

    const { firstName, lastName, emailId } = req.user;

    const order = await razorpayInstance.orders.create({
      amount: membershipAmount[membershipType] * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        firstName,
        lastName,
        emailId,
        membershipType,
      },
    });

    const payment = new Payment({
      userId: req.user._id,
      orderId: order.id,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      notes: order.notes,
    });

    const savedPayment = await payment.save();

    return res.json({
      ...savedPayment.toJSON(),
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Payment order creation error:", err);
    return res.status(500).json({ msg: "Unable to create payment order" });
  }
});

// Razorpay webhook
paymentRouter.post("/payment/webhook", async (req, res) => {
  try {
    console.log("Webhook Called");

    const signature = req.get("X-Razorpay-Signature");
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const rawBody = req.rawBody;

    if (!signature || !secret || !rawBody) {
      console.error("Webhook signature, secret, or raw body missing");
      return res.status(400).json({ msg: "Webhook configuration missing" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const expected = Buffer.from(expectedSignature, "hex");
    const received = Buffer.from(signature, "hex");

    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      console.error("Invalid webhook signature");
      return res.status(400).json({ msg: "Invalid webhook signature" });
    }

    console.log("Valid Webhook Signature");

    const event = req.body?.event;

    // Activate membership only after payment is captured.
    if (event !== "payment.captured") {
      console.log("Ignoring webhook event:", event);
      return res.status(200).json({ msg: "Event received" });
    }

    const paymentDetails = req.body?.payload?.payment?.entity;

    if (
      !paymentDetails?.order_id ||
      paymentDetails.status !== "captured"
    ) {
      return res.status(400).json({ msg: "Invalid payment details" });
    }

    const payment = await Payment.findOne({
      orderId: paymentDetails.order_id,
    });

    if (!payment) {
      console.error("Payment record not found:", paymentDetails.order_id);
      return res.status(404).json({ msg: "Payment record not found" });
    }

    if (Number(payment.amount) !== Number(paymentDetails.amount)) {
      console.error("Payment amount mismatch");
      return res.status(400).json({ msg: "Payment amount mismatch" });
    }

    const membershipType = payment.notes?.membershipType;

    if (!["silver", "gold"].includes(membershipType)) {
      console.error("Invalid membership type in payment record");
      return res.status(400).json({ msg: "Invalid membership type" });
    }

    const user = await User.findById(payment.userId);

    if (!user) {
      console.error("User not found for payment:", payment.orderId);
      return res.status(404).json({ msg: "User not found" });
    }

    // Save captured payment status.
    payment.status = paymentDetails.status;
    await payment.save();
    console.log("Payment saved:", payment.orderId);

    // Activate the correct user's membership.
    user.isPremium = true;
    user.membershipType = membershipType;
    await user.save();

    console.log("Premium activated:", user._id, membershipType);

    return res.status(200).json({
      msg: "Payment captured and membership activated",
    });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return res.status(500).json({ msg: "Webhook processing failed" });
  }
});

// Verify logged-in user's premium status
paymentRouter.get("/premium/verify", userAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "isPremium membershipType"
    );

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    return res.json({
      isPremium: Boolean(user.isPremium),
      membershipType: user.membershipType || null,
    });
  } catch (err) {
    console.error("Premium verification error:", err);
    return res.status(500).json({ msg: "Unable to verify membership" });
  }
});


paymentRouter.get("/webhook-test", (req, res) => {
  res.json({ message: "DevTinder backend is reachable locally" });
});


module.exports = paymentRouter;
