const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');


async function makePayment(req, res, next) {
  try {
    const { bookingId } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });
    if (!booking) return next(new AppError('Booking not found', 404));
    if (booking.userId !== req.user.id) {
      return next(new AppError('You do not have access to this booking', 403));
    }
    if (booking.payment) {
      
      return res.status(200).json({ booking, payment: booking.payment, duplicate: true });
    }
    if (booking.status !== 'PENDING') {
      return next(new AppError(`Booking is ${booking.status}, not payable`, 400));
    }

    
    const outcome = req.body.simulate === 'FAILED'
      ? 'FAILED'
      : req.body.simulate === 'SUCCESS'
        ? 'SUCCESS'
        : Math.random() < 0.8 ? 'SUCCESS' : 'FAILED';

    const [payment, updatedBooking] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          bookingId: booking.id,
          amount: booking.amount,
          status: outcome,
          reference: `SIM-${uuidv4()}`,
        },
      }),
      prisma.booking.update({
        where: { id: booking.id },
        data: { status: outcome === 'SUCCESS' ? 'CONFIRMED' : 'FAILED' },
      }),
    ]);

    res.status(201).json({ booking: updatedBooking, payment });
  } catch (err) {
    next(err);
  }
}


async function handleWebhook(req, res, next) {
  try {
    const { eventId, bookingId, status, reference } = req.body;

    if (!eventId || !bookingId || !['SUCCESS', 'FAILED'].includes(status)) {
      return next(new AppError('Invalid webhook payload', 400));
    }

    const result = await prisma.$transaction(async (tx) => {
      
      await tx.webhookEvent.create({
        data: { eventId, payload: req.body },
      });

      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { payment: true },
      });
      if (!booking) {
        throw new AppError('Booking not found', 404);
      }

      
      if (booking.payment) {
        return { booking, payment: booking.payment, duplicate: true };
      }

      const payment = await tx.payment.create({
        data: {
          bookingId: booking.id,
          amount: booking.amount,
          status,
          reference: reference || `WH-${uuidv4()}`,
        },
      });
      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: { status: status === 'SUCCESS' ? 'CONFIRMED' : 'FAILED' },
      });

      return { booking: updatedBooking, payment, duplicate: false };
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err.code === 'P2002' && err.meta?.target?.includes('eventId')) {
      
      return res.status(200).json({ message: 'Event already processed', duplicate: true });
    }
    next(err);
  }
}

module.exports = { makePayment, handleWebhook };
