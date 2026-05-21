function validate(schema) {
  return function(req, res, next) {
    var errors = [];

    Object.keys(schema).forEach(function(field) {
      var rule = schema[field];
      var value = req.body[field];

      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({ field: field, message: rule.message });
        return;
      }

      if (!rule.validate(value)) {
        errors.push({ field: field, message: rule.message });
      }
    });

    if (errors.length > 0) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors
      });
    }

    next();
  };
}

module.exports = validate;
