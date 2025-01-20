const express = require('express');
const router = express.Router();
const axios = require('axios');

const APIKEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// One-time full payment
router.post('/pay', async (req, res) => {
  try {
    const { email, amount } = req.body;
    
    const params = {
      email,
      amount: amount * 100, // Convert to kobo
      callback_url: 'https://yourdomain.com/payment/callback',
      reference: `ref-${Date.now()}`
    };

    const response = await axios.post(`${PAYSTACK_BASE_URL}/transaction/initialize`, params, {
      headers: {
        Authorization: `Bearer ${APIKEY}`,
        'Content-Type': 'application/json'
      }
    });

    res.status(200).json({
      status: true,
      data: response.data.data
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message
    });
  }
});

// Installmental payment
router.post('/pay-installment', async (req, res) => {
  try {
    const { email, totalAmount, installments } = req.body;
    const installmentAmount = Math.ceil(totalAmount / installments);

    // Create payment plan
    const planParams = {
      name: `Installment Plan-${Date.now()}`,
      interval: 'monthly',
      amount: installmentAmount * 100, // Convert to kobo
      duration: installments
    };

    const planResponse = await axios.post(`${PAYSTACK_BASE_URL}/plan`, planParams, {
      headers: {
        Authorization: `Bearer ${APIKEY}`,
        'Content-Type': 'application/json'
      }
    });

    // initialize transaction with payment plan
    const transactionParams = {
      email,
      amount: installmentAmount * 100,
      plan: planResponse.data.data.plan_code,
      callback_url: 'https://yourdomain.com/payment/callback'
    };

    const response = await axios.post(`${PAYSTACK_BASE_URL}/transaction/initialize`, transactionParams, {
      headers: {
        Authorization: `Bearer ${APIKEY}`,
        'Content-Type': 'application/json'
      }
    });

    res.status(200).json({
      status: true,
      data: response.data.data
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message
    });
  }
});

// Verify payment
router.get('/verify/:reference', async (req, res) => {
  try {
    const reference = req.params.reference;
    const verification = await axios.get(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${APIKEY}`,
        'Content-Type': 'application/json'
      }
    });

    res.status(200).json({
      status: true,
      data: verification.data.data
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message
    });
  }
});

module.exports = router;
