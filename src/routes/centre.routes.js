const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const requireAuth = require('../middleware/auth');
const {
  listCentres,
  getCentre,
  createCentre,
  addTestToCentre,
} = require('../controllers/centre.controller');

const router = express.Router();

const centreSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
});

const testSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
});

router.get('/', listCentres);
router.get('/:id', getCentre);
router.post('/', requireAuth, validate(centreSchema), createCentre);
router.post('/:id/tests', requireAuth, validate(testSchema), addTestToCentre);

module.exports = router;
