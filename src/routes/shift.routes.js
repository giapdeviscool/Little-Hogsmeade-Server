var express = require('express');
var shiftController = require('../controllers/shift.controller');
var authMiddleware = require('../middlewares/auth.middleware');

var router = express.Router();

router.use(authMiddleware.authenticate);
router.use(authMiddleware.requireChainRole);

// UC59: Manage shift categories
router.get('/', shiftController.getShifts);
router.post('/', shiftController.createShift);
router.put('/:id', shiftController.updateShift);
router.delete('/:id', shiftController.deleteShift);

module.exports = router;
