function isOptionalPositiveNumber(value) {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value > 0);
}

var checkInSchema = {
  actual_guest_count: {
    required: false,
    validate: isOptionalPositiveNumber,
    message: 'actual_guest_count must be a number greater than 0'
  }
};

var noShowSchema = {
  status: {
    required: true,
    validate: function(value) {
      return typeof value === 'string' && value.trim().toLowerCase() === 'no_show';
    },
    message: 'status must be no_show'
  }
};

module.exports = {
  checkInSchema: checkInSchema,
  noShowSchema: noShowSchema
};
