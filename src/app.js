require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const centreRoutes = require('./routes/centre.routes');
const bookingRoutes = require('./routes/booking.routes');
const paymentRoutes = require('./routes/payment.routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./docs/openapi');

const app = express();

app.use(express.json());
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(limiter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.use('/auth', authRoutes);
app.use('/centres', centreRoutes);
app.use('/bookings', bookingRoutes);
app.use('/payments', paymentRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
