const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

async function createBooking(req, res, next) {
  try {
    const { testId, appointmentAt } = req.body;

    const test = await prisma.test.findUnique({ where: { id: testId } });
    if (!test) return next(new AppError('Diagnostic test not found', 404));

    const booking = await prisma.booking.create({
      data: {
        userId: req.user.id,
        testId: test.id,
        centreId: test.centreId,
        appointmentAt: new Date(appointmentAt),
        amount: test.price,
        status: 'PENDING',
      },
      include: { test: true, centre: true },
    });

    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
}

async function listMyBookings(req, res, next) {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user.id },
      include: { test: true, centre: true, payment: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(bookings);
  } catch (err) {
    next(err);
  }
}

async function getBooking(req, res, next) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { test: true, centre: true, payment: true },
    });
    if (!booking) return next(new AppError('Booking not found', 404));
    if (booking.userId !== req.user.id) {
      return next(new AppError('You do not have access to this booking', 403));
    }
    res.json(booking);
  } catch (err) {
    next(err);
  }
}

async function cancelBooking(req, res, next) {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return next(new AppError('Booking not found', 404));
    if (booking.userId !== req.user.id) {
      return next(new AppError('You do not have access to this booking', 403));
    }
    if (booking.status !== 'PENDING') {
      return next(new AppError(`Cannot cancel a booking in ${booking.status} state`, 400));
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED' },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = { createBooking, listMyBookings, getBooking, cancelBooking };
