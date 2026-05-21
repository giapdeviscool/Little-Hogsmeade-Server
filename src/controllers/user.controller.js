var userService = require('../services/user.service');

async function getUsers(req, res, next) {
  try {
    var users = await userService.getUsers();
    res.json({ data: users });
  } catch (error) {
    next(error);
  }
}

async function getUserById(req, res, next) {
  try {
    var user = await userService.getUserById(req.params.id);
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
}

async function createUser(req, res, next) {
  try {
    var user = await userService.createUser(req.body);
    res.status(201).json({ data: user });
  } catch (error) {
    next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    var user = await userService.updateUser(req.params.id, req.body);
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    await userService.deleteUser(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getUsers: getUsers,
  getUserById: getUserById,
  createUser: createUser,
  updateUser: updateUser,
  deleteUser: deleteUser
};
