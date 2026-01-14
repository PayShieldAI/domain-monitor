const AppError = require('../utils/AppError');

function validate(schema, property = 'body') {
  return (req, _res, next) => {
    const data = req[property];

    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      }));

      const err = new AppError('Validation failed', 422, 'VALIDATION_ERROR');
      err.details = details;

      return next(err);
    }

    req[property] = value;
    next();
  };
}

module.exports = validate;
