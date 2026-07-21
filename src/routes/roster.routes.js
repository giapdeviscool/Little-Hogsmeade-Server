var express = require('express');
var rosterController = require('../controllers/roster.controller');
var authMiddleware = require('../middlewares/auth.middleware');

var router = express.Router();

router.use(authMiddleware.authenticate);



router.use(authMiddleware.authenticate);

// UC60: GET is accessible by all authenticated roles (Staff/Cashier see only their own via service layer)
router.get('/', rosterController.getRosters);

// Only Owner/Chain Admin can create/delete schedules
router.post('/', authMiddleware.requireChainRole, rosterController.createRoster);
router.delete('/:id', authMiddleware.requireChainRole, rosterController.deleteRoster);

module.exports = router;
