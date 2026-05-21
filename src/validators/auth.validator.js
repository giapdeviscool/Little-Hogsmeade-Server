function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isOptionalEmail(value) {
  return value === undefined || value === null || value === '' || isEmail(value);
}

function isPassword(value) {
  return typeof value === 'string' && value.length >= 6;
}

function isString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalString(value) {
  return value === undefined || value === null || value === '' || typeof value === 'string';
}

var registerSchema = {
  accountType: {
    required: false,
    validate: function(value) {
      return value === undefined || value === 'customer' || value === 'employee';
    },
    message: 'Account type must be customer or employee'
  },
  fullName: {
    required: true,
    validate: isString,
    message: 'Full name is required'
  },
  phone: {
    required: true,
    validate: isString,
    message: 'Phone is required'
  },
  email: {
    required: false,
    validate: isOptionalEmail,
    message: 'Email must be valid'
  },
  password: {
    required: true,
    validate: isPassword,
    message: 'Password is required and must be at least 6 characters'
  },
  avatarUrl: {
    required: false,
    validate: isOptionalString,
    message: 'Avatar URL must be a string'
  },
  birthday: {
    required: false,
    validate: isOptionalString,
    message: 'Birthday must be an ISO date string'
  },
  branchId: {
    required: false,
    validate: isOptionalString,
    message: 'Branch id must be a string'
  },
  roleId: {
    required: false,
    validate: isOptionalString,
    message: 'Role id must be a string'
  },
  pinCode: {
    required: false,
    validate: isOptionalString,
    message: 'Pin code must be a string'
  }
};

var loginSchema = {
  identifier: {
    required: true,
    validate: isString,
    message: 'Identifier is required'
  },
  password: {
    required: true,
    validate: isPassword,
    message: 'Password is required and must be at least 6 characters'
  }
};

module.exports = {
  registerSchema: registerSchema,
  loginSchema: loginSchema
};
