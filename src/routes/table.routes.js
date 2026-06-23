var express = require('express');
var authMiddleware = require('../middlewares/auth.middleware');
var validate = require('../middlewares/validate.middleware');
var tableValidator = require('../validators/table.validator');
var tableController = require('../controllers/table.controller');

var router = express.Router();

router.patch('/:id/status',
  authMiddleware.authenticate,
  validate(tableValidator.updateTableStatusSchema),
  tableController.updateTableStatus
);

module.exports = router;
