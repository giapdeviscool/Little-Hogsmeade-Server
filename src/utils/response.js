function success(res, data, statusCode) {
  return res.status(statusCode || 200).json({ data: data });
}

module.exports = {
  success: success
};
