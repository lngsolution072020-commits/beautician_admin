// Generic request validator middleware using Joi schemas
// Accepts an object with optional body, params, query validators

const ApiError = require('../utils/apiError');

const validate = (schemas) => (req, res, next) => {
  const sources = ['body', 'params', 'query'];

  try {
    sources.forEach((source) => {
      if (schemas[source]) {
        const { error, value } = schemas[source].validate(req[source], {
          abortEarly: false,
          allowUnknown: false,
          stripUnknown: true,
          convert: true
        });

        if (error) {
          throw new ApiError(
            400,
            'Validation error',
            error.details.map((d) => d.message)
          );
        }

        // Overwrite with validated/sanitized value
        // eslint-disable-next-line no-param-reassign
        req[source] = value;
      }
    });

    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = validate;

