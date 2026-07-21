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

var statusSchema = {
  status: {
    required: true,
    validate: function(value) {
      return typeof value === 'string' && ['cancelled', 'no_show', 'pending', 'confirmed', 'completed'].includes(value.trim().toLowerCase());
    },
    message: 'status must be cancelled, no_show, pending, confirmed, or completed'
  }
};

module.exports = {
  checkInSchema: checkInSchema,
  statusSchema: statusSchema
};
