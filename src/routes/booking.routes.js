const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const requireAuth = require('../middleware/auth');
const {
  createBooking,
  listMyBookings,
  getBooking,
  cancelBooking,
} = require('../controllers/booking.controller');

const router = express.Router();
router.use(requireAuth); 

const bookingSchema = z.object({
  testId: z.string().uuid(),
  appointmentAt: z.string().datetime(),
});

router.post('/', validate(bookingSchema), createBooking);
router.get('/', listMyBookings);
router.get('/:id', getBooking);
router.post('/:id/cancel', cancelBooking);

module.exports = router;
