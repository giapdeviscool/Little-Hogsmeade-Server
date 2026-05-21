var authService = require('../services/auth.service');

async function register(req, res, next) {
  try {
    var result = await authService.register(req.body);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    var result = await authService.login(req.body);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register: register,
  login: login
};
