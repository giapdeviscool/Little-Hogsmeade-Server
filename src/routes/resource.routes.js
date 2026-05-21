var express = require('express');
var resourceController = require('../controllers/resource.controller');

function createResourceRouter(resource) {
  var router = express.Router();
  var controller = resourceController.createController(resource);

  router.get('/', controller.getItems);
  router.get('/:id', controller.getItemById);
  router.post('/', controller.createItem);
  router.patch('/:id', controller.updateItem);
  router.delete('/:id', controller.deleteItem);

  return router;
}

module.exports = createResourceRouter;
