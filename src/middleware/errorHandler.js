const AppError = require('../utils/AppError');

function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Resource not found' });
  }
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Duplicate value for a unique field' });
  }

  console.error(err); 
  return res.status(500).json({ error: 'Internal server error' });
}

function notFound(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
}

module.exports = { errorHandler, notFound };
