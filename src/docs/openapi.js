// Hand-written OpenAPI 3.0 spec. Kept as one plain JS object (rather than
// JSDoc comments scattered across route files) so it's easy to read, edit,
// and keep in sync with the actual routes in one place.
module.exports = {
  openapi: '3.0.0',
  info: {
    title: 'EVE Diagnostics API',
    version: '1.0.0',
    description: 'Diagnostic test booking & simulated payment service.',
  },
  servers: [{ url: 'http://localhost:4000' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Test: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          price: { type: 'string', example: '350' },
          centreId: { type: 'string', format: 'uuid' },
        },
      },
      Centre: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          location: { type: 'string' },
          tests: { type: 'array', items: { $ref: '#/components/schemas/Test' } },
        },
      },
      Booking: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          testId: { type: 'string', format: 'uuid' },
          centreId: { type: 'string', format: 'uuid' },
          appointmentAt: { type: 'string', format: 'date-time' },
          amount: { type: 'string', example: '350' },
          status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED'] },
        },
      },
      Payment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          bookingId: { type: 'string', format: 'uuid' },
          amount: { type: 'string', example: '350' },
          status: { type: 'string', enum: ['SUCCESS', 'FAILED'] },
          reference: { type: 'string', example: 'SIM-...' },
        },
      },
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
    },
  },
  paths: {
    '/auth/signup': {
      post: {
        tags: ['Auth'],
        summary: 'Create a new user account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 6 },
                  name: { type: 'string' },
                },
              },
              example: { email: 'jane@example.com', password: 'secret123', name: 'Jane' },
            },
          },
        },
        responses: {
          201: { description: 'User created, returns user + JWT' },
          409: { description: 'Email already registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          400: { description: 'Validation error' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in and receive a JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
              example: { email: 'jane@example.com', password: 'secret123' },
            },
          },
        },
        responses: {
          200: { description: 'Login successful, returns user + JWT' },
          401: { description: 'Invalid email or password', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/centres': {
      get: {
        tags: ['Centres'],
        summary: 'List all diagnostic centres and their tests',
        responses: {
          200: {
            description: 'List of centres',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Centre' } } } },
          },
        },
      },
      post: {
        tags: ['Centres'],
        summary: 'Create a diagnostic centre',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'location'],
                properties: { name: { type: 'string' }, location: { type: 'string' } },
              },
            },
          },
        },
        responses: { 201: { description: 'Centre created' }, 401: { description: 'Missing/invalid token' } },
      },
    },
    '/centres/{id}': {
      get: {
        tags: ['Centres'],
        summary: 'Get one centre by id (with its tests)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Centre found' }, 404: { description: 'Centre not found' } },
      },
    },
    '/centres/{id}/tests': {
      post: {
        tags: ['Centres'],
        summary: 'Add a diagnostic test to a centre',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'price'],
                properties: { name: { type: 'string' }, price: { type: 'number' } },
              },
            },
          },
        },
        responses: { 201: { description: 'Test created' }, 404: { description: 'Centre not found' } },
      },
    },
    '/bookings': {
      post: {
        tags: ['Bookings'],
        summary: 'Book a diagnostic test (creates a PENDING booking)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['testId', 'appointmentAt'],
                properties: {
                  testId: { type: 'string', format: 'uuid' },
                  appointmentAt: { type: 'string', format: 'date-time' },
                },
              },
              example: { testId: '<test-uuid>', appointmentAt: '2026-10-01T09:00:00.000Z' },
            },
          },
        },
        responses: {
          201: { description: 'Booking created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } } },
          404: { description: 'Test not found' },
        },
      },
      get: {
        tags: ['Bookings'],
        summary: "List the caller's own bookings",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'List of bookings' } },
      },
    },
    '/bookings/{id}': {
      get: {
        tags: ['Bookings'],
        summary: 'Get one booking by id (owner only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Booking found' },
          403: { description: "Not this user's booking" },
          404: { description: 'Booking not found' },
        },
      },
    },
    '/bookings/{id}/cancel': {
      post: {
        tags: ['Bookings'],
        summary: 'Cancel a booking (only while still PENDING)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Booking cancelled' },
          400: { description: 'Booking is not in a cancellable state' },
          403: { description: "Not this user's booking" },
        },
      },
    },
    '/payments': {
      post: {
        tags: ['Payments'],
        summary: 'Simulate paying for a booking',
        description: 'If `simulate` is omitted, the outcome is randomized (80% SUCCESS). Calling this twice on the same booking is safe — the second call returns the existing payment with `duplicate: true` instead of charging again.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['bookingId'],
                properties: {
                  bookingId: { type: 'string', format: 'uuid' },
                  simulate: { type: 'string', enum: ['SUCCESS', 'FAILED'] },
                },
              },
              example: { bookingId: '<booking-uuid>', simulate: 'SUCCESS' },
            },
          },
        },
        responses: {
          201: { description: 'Payment processed, booking updated' },
          200: { description: 'Booking was already paid — returns existing payment, duplicate: true' },
          400: { description: 'Booking is not in a payable state' },
        },
      },
    },
    '/payments/webhook': {
      post: {
        tags: ['Payments'],
        summary: 'Simulated payment-provider webhook (idempotent)',
        description: 'Simulates an async status push from the payment provider. The same `eventId` delivered more than once has no additional effect — the second (and later) delivery returns `duplicate: true` without touching booking/payment state. Not authenticated with a user JWT; optionally gated by an `X-Webhook-Secret` header if `WEBHOOK_SECRET` is set.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['eventId', 'bookingId', 'status'],
                properties: {
                  eventId: { type: 'string' },
                  bookingId: { type: 'string', format: 'uuid' },
                  status: { type: 'string', enum: ['SUCCESS', 'FAILED'] },
                  reference: { type: 'string' },
                },
              },
              example: { eventId: 'evt_123', bookingId: '<booking-uuid>', status: 'SUCCESS' },
            },
          },
        },
        responses: {
          200: { description: 'Processed (or already-processed duplicate)' },
          400: { description: 'Invalid webhook payload' },
          404: { description: 'Booking not found' },
        },
      },
    },
  },
};