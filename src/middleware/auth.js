const { verifyToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');


function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError('Missing or malformed Authorization header', 401));
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    next(new AppError('Invalid or expired token', 401));
  }
}

module.exports = requireAuth;
