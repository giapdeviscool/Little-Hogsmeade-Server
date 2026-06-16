var rosterService = require('../services/roster.service');

async function getRosters(req, res, next) {
  try {
    var rosters = await rosterService.getRosters(req.query, req.user);
    res.json({ data: rosters });
  } catch (error) {
    next(error);
  }
}

async function createRoster(req, res, next) {
  try {
    var result;
    // Support both single and bulk creation
    if (Array.isArray(req.body.entries)) {
      result = await rosterService.createBulkRosters(req.body.entries, req.user);
      res.status(201).json({
        data: result,
        message: 'Schedule entries processed'
      });
    } else {
      result = await rosterService.createRoster(req.body, req.user);
      res.status(201).json({
        data: result,
        message: 'Schedule entry created successfully'
      });
    }
  } catch (error) {
    next(error);
  }
}

async function deleteRoster(req, res, next) {
  try {
    var result = await rosterService.deleteRoster(req.params.id, req.user);
    res.json({ message: result.message });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getRosters: getRosters,
  createRoster: createRoster,
  deleteRoster: deleteRoster
};
