var express = require('express');
var userController = require('../controllers/user.controller');
var validate = require('../middlewares/validate.middleware');
var userValidator = require('../validators/user.validator');

var router = express.Router();

router.get('/', userController.getUsers);
router.get('/:id', userController.getUserById);
router.post('/', validate(userValidator.createUserSchema), userController.createUser);
router.patch('/:id', validate(userValidator.updateUserSchema), userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
