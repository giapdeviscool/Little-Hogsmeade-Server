var VALID_STATUSES = ['available', 'occupied', 'reserved'];

function isOptionalPositiveNumber(value) {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value > 0);
}

function isOptionalObjectId(value) {
  return value === undefined || (typeof value === 'string' && /^[a-f\d]{24}$/i.test(value));
}

function isOptionalString(value) {
  return value === undefined || typeof value === 'string';
}

var updateTableStatusSchema = {
  status: {
    required: true,
    validate: function(value) {
      return typeof value === 'string' && VALID_STATUSES.indexOf(value.trim().toLowerCase()) > -1;
    },
    message: 'status must be one of: available, occupied, reserved'
  },
  guest_count: {
    required: false,
    validate: isOptionalPositiveNumber,
    message: 'guest_count must be a number greater than 0'
  },
  order_id: {
    required: false,
    validate: isOptionalObjectId,
    message: 'order_id must be a valid ObjectId'
  },
  reservation_id: {
    required: false,
    validate: isOptionalObjectId,
    message: 'reservation_id must be a valid ObjectId'
  },
  note: {
    required: false,
    validate: isOptionalString,
    message: 'note must be a string'
  }
};

module.exports = {
  updateTableStatusSchema: updateTableStatusSchema
};
