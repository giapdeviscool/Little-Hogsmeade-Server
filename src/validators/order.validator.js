var objectIdPattern = /^[a-f\d]{24}$/i;

function isValidObjectId(value) {
  return typeof value === 'string' && objectIdPattern.test(value);
}

function isPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function validateTopping(topping) {
  if (!topping || typeof topping !== 'object') {
    return false;
  }

  return isValidObjectId(topping.toppingId)
    && isPositiveInteger(topping.quantity)
    && isPositiveNumber(topping.extraPrice);
}

function validateOrderItem(item) {
  if (!item || typeof item !== 'object') {
    return false;
  }

  if (!isValidObjectId(item.menuItemId)) {
    return false;
  }

  if (!isPositiveNumber(item.unitPrice)) {
    return false;
  }

  if (!isPositiveInteger(item.quantity)) {
    return false;
  }

  if (item.subtotal !== undefined && !isPositiveNumber(item.subtotal)) {
    return false;
  }

  if (item.toppings !== undefined) {
    if (!Array.isArray(item.toppings)) {
      return false;
    }

    return item.toppings.every(validateTopping);
  }

  return true;
}

var createOrderSchema = {
  customerId: {
    required: false,
    validate: function(value) {
      return value === undefined || value === null || isValidObjectId(value);
    },
    message: 'customerId must be a valid object id'
  },
  status: {
    required: false,
    validate: function(value) {
      return value === undefined || typeof value === 'string';
    },
    message: 'status must be a string'
  },
  paymentMethod: {
    required: true,
    validate: function(value) {
      return typeof value === 'string' && value.trim() !== '';
    },
    message: 'paymentMethod is required'
  },
  discountAmount: {
    required: false,
    validate: function(value) {
      return value === undefined || isPositiveNumber(value);
    },
    message: 'discountAmount must be a non-negative number'
  },
  taxAmount: {
    required: false,
    validate: function(value) {
      return value === undefined || isPositiveNumber(value);
    },
    message: 'taxAmount must be a non-negative number'
  },
  items: {
    required: true,
    validate: function(value) {
      return Array.isArray(value) && value.length > 0 && value.every(validateOrderItem);
    },
    message: 'items must be a non-empty array of valid order items'
  }
};

var updateOrderStatusSchema = {
  status: {
    required: true,
    validate: function(value) {
      return typeof value === 'string' && ['paid', 'pending', 'cancelled', 'refunded'].indexOf(value) > -1;
    },
    message: 'status is required and must be one of paid, pending, cancelled, refunded'
  }
};

module.exports = {
  createOrderSchema: createOrderSchema,
  updateOrderStatusSchema: updateOrderStatusSchema
};
