const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

async function listCentres(req, res, next) {
  try {
    const centres = await prisma.centre.findMany({ include: { tests: true } });
    res.json(centres);
  } catch (err) {
    next(err);
  }
}

async function getCentre(req, res, next) {
  try {
    const centre = await prisma.centre.findUnique({
      where: { id: req.params.id },
      include: { tests: true },
    });
    if (!centre) return next(new AppError('Centre not found', 404));
    res.json(centre);
  } catch (err) {
    next(err);
  }
}


async function createCentre(req, res, next) {
  try {
    const { name, location } = req.body;
    const centre = await prisma.centre.create({ data: { name, location } });
    res.status(201).json(centre);
  } catch (err) {
    next(err);
  }
}

async function addTestToCentre(req, res, next) {
  try {
    const centre = await prisma.centre.findUnique({ where: { id: req.params.id } });
    if (!centre) return next(new AppError('Centre not found', 404));

    const { name, price } = req.body;
    const test = await prisma.test.create({
      data: { name, price, centreId: centre.id },
    });
    res.status(201).json(test);
  } catch (err) {
    next(err);
  }
}

module.exports = { listCentres, getCentre, createCentre, addTestToCentre };
