var branchService = require('../services/branch.service');

async function getBranches(req, res, next) {
  try {
    var result = await branchService.getBranches(req.query || {});
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function createBranch(req, res, next) {
  try {
    var branch = await branchService.createBranch(req.body);
    res.status(201).json({ data: branch });
  } catch (error) {
    next(error);
  }
}

async function updateBranch(req, res, next) {
  try {
    var branch = await branchService.updateBranch(req.params.id, req.body);
    res.json({ data: branch });
  } catch (error) {
    next(error);
  }
}

async function toggleBranchStatus(req, res, next) {
  try {
    var branch = await branchService.toggleBranchStatus(req.params.id);
    res.json({ data: branch });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getBranches: getBranches,
  createBranch: createBranch,
  updateBranch: updateBranch,
  toggleBranchStatus: toggleBranchStatus
};
