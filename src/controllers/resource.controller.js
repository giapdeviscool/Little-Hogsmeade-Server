var resourceService = require('../services/resource.service');

function createController(resource) {
  return {
    getItems: function(req, res, next) {
      resourceService.getItems(resource, req.query)
        .then(function(items) {
          res.json({ data: items });
        })
        .catch(next);
    },

    getItemById: function(req, res, next) {
      resourceService.getItemById(resource, req.params.id)
        .then(function(item) {
          res.json({ data: item });
        })
        .catch(next);
    },

    createItem: function(req, res, next) {
      resourceService.createItem(resource, req.body)
        .then(function(item) {
          res.status(201).json({ data: item });
        })
        .catch(next);
    },

    updateItem: function(req, res, next) {
      resourceService.updateItem(resource, req.params.id, req.body)
        .then(function(item) {
          res.json({ data: item });
        })
        .catch(next);
    },

    deleteItem: function(req, res, next) {
      resourceService.deleteItem(resource, req.params.id)
        .then(function() {
          res.status(204).send();
        })
        .catch(next);
    }
  };
}

module.exports = {
  createController: createController
};
