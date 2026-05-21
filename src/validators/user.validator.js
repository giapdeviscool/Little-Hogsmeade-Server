var createUserSchema = {
  email: {
    required: true,
    validate: function(value) {
      return typeof value === 'string' && value.indexOf('@') > -1;
    },
    message: 'Email is required and must be valid'
  },
  name: {
    required: false,
    validate: function(value) {
      return value === undefined || value === null || typeof value === 'string';
    },
    message: 'Name must be a string'
  }
};

var updateUserSchema = {
  email: {
    required: false,
    validate: function(value) {
      return value === undefined || typeof value === 'string' && value.indexOf('@') > -1;
    },
    message: 'Email must be valid'
  },
  name: {
    required: false,
    validate: function(value) {
      return value === undefined || value === null || typeof value === 'string';
    },
    message: 'Name must be a string'
  }
};

module.exports = {
  createUserSchema: createUserSchema,
  updateUserSchema: updateUserSchema
};
