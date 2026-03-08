// Generic request validator middleware using Joi schemas
// Accepts an object with optional body, params, query validators

const ApiError = require('../utils/apiError');

// Strip empty string from query/body so Joi optional() accepts omitted keys
function stripEmptyStrings(obj) {
  if (!obj || typeof obj !== 'object') return;
  Object.keys(obj).forEach((key) => {
    if (obj[key] === '') {
      // eslint-disable-next-line no-param-reassign
      delete obj[key];
    }
  });
}

const validate = (schemas) => (req, res, next) => {
  const sources = ['body', 'params', 'query'];

  try {
    stripEmptyStrings(req.query);
    stripEmptyStrings(req.body);

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

