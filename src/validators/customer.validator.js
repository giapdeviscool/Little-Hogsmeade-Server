var quickRegisterSchema = {
  name: {
    required: true,
    validate: function(value) {
      return typeof value === 'string' && value.trim().length > 0;
    },
    message: 'Tên khách hàng là bắt buộc và không được để trống.'
  },
  phone: {
    required: true,
    validate: function(value) {
      return typeof value === 'string' && /^(0[3|5|7|8|9])+([0-9]{8})$/.test(value);
    },
    message: 'Số điện thoại không hợp lệ. Phải gồm 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09.'
  }
};

module.exports = {
  quickRegisterSchema: quickRegisterSchema
};
