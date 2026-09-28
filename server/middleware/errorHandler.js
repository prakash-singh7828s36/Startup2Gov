// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const isAuthRoute = req.originalUrl.split('?')[0].startsWith('/api/auth/');
  const loggedStatus =
    err.statusCode ||
    err.status ||
    (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : null) ||
    (err.code === 11000 ? 409 : 500);

  // Never log sensitive bodies (passwords, tokens)
  console.error('[API Error]', {
    method: req.method,
    path: isAuthRoute ? req.path : req.originalUrl,
    message: isAuthRoute || err.code === 11000 ? 'Request failed.' : err.message,
    status: loggedStatus,
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: messages,
    });
  }

  // Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    const duplicateFields = err.keyPattern || err.keyValue || {};
    if (
      (duplicateFields.user && duplicateFields.challengeId) ||
      err.message?.includes('user_1_challengeId_1')
    ) {
      return res.status(409).json({
        success: false,
        message: 'You have already submitted an active application to this challenge.',
      });
    }

    const field = Object.keys(err.keyValue || {})[0] || 'Field';
    return res.status(409).json({
      success: false,
      message: `A record with this ${field} already exists.`,
    });
  }

  // CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid format for resource ID: ${err.value}`,
    });
  }

  // Default server error
  const statusCode = err.statusCode || err.status || 500;
  return res.status(statusCode).json({
    success: false,
    message: isAuthRoute ? 'Authentication request failed.' : err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && !isAuthRoute && { stack: err.stack }),
  });
}
