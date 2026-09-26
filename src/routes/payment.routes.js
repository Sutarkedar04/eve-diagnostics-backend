const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const requireAuth = require('../middleware/auth');
const { makePayment, handleWebhook } = require('../controllers/payment.controller');

const router = express.Router();

const paymentSchema = z.object({
  bookingId: z.string().uuid(),
  simulate: z.enum(['SUCCESS', 'FAILED']).optional(),
});

const webhookSchema = z.object({
  eventId: z.string().min(1),
  bookingId: z.string().uuid(),
  status: z.enum(['SUCCESS', 'FAILED']),
  reference: z.string().optional(),
});


router.post('/', requireAuth, validate(paymentSchema), makePayment);
router.post('/webhook', validate(webhookSchema), (req, res, next) => {
  const secret = req.headers['x-webhook-secret'];
  if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }
  next();
}, handleWebhook);

module.exports = router;
