var express = require('express');
var shiftController = require('../controllers/shift.controller');
var authMiddleware = require('../middlewares/auth.middleware');

var router = express.Router();

router.use(authMiddleware.authenticate);
router.use(authMiddleware.verifyRole(['owner', 'chain admin']));


// UC59: Manage shift categories (Chain Admin / Owner restricted)
router.get('/', authMiddleware.requireChainRole, shiftController.getShifts);
router.post('/', authMiddleware.requireChainRole, shiftController.createShift);
router.put('/:id', authMiddleware.requireChainRole, shiftController.updateShift);
router.delete('/:id', authMiddleware.requireChainRole, shiftController.deleteShift);

// UC49: EOD Reconciliation and Shift Closure
router.post('/request-closure', shiftController.requestClosure);
router.post('/finalize-closure', shiftController.finalizeClosure);
router.get('/:shiftId/reconciliation', shiftController.getReconciliation);

module.exports = router;
