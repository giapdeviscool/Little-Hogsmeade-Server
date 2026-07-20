var quickRegisterSchema = {
  name: {
    required: true,
    validate: function (value) {
      return typeof value === 'string' && value.trim().length > 0;
    },
    message: 'Tên khách hàng là bắt buộc và không được để trống.'
  },
  phone: {
    required: true,
    validate: function (value) {
      return typeof value === 'string' && /^0[1-9][0-9]{8}$/.test(value);
    },
    message: 'Số điện thoại không hợp lệ. Phải gồm 10 chữ số (vd: 0987654321).'
  }
};

module.exports = {
  quickRegisterSchema: quickRegisterSchema
};
