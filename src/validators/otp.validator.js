var verifyOtpSchema = {
  code: {
    required: true,
    validate: function(value) {
      return typeof value === 'string' && /^\d{6}$/.test(value);
    },
    message: 'Code is required and must be a 6-digit numeric string'
  }
};

module.exports = {
  verifyOtpSchema: verifyOtpSchema
};
