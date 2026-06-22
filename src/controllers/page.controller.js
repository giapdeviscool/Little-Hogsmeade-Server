var pageService = require("../services/page.service");

async function getPages(req, res, next) {
  try {
    var result = await pageService.getPages(req.query || {});
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function getPageById(req, res, next) {
  try {
    var page = await pageService.getPageById(req.params.id);
    res.json({ data: page });
  } catch (error) {
    next(error);
  }
}

async function createPage(req, res, next) {
  try {
    var page = await pageService.createPage(req.body);
    res.status(201).json({ data: page });
  } catch (error) {
    next(error);
  }
}

async function updatePage(req, res, next) {
  try {
    var page = await pageService.updatePage(req.params.id, req.body);
    res.json({ data: page });
  } catch (error) {
    next(error);
  }
}

async function deletePage(req, res, next) {
  try {
    await pageService.deletePage(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPages: getPages,
  getPageById: getPageById,
  createPage: createPage,
  updatePage: updatePage,
  deletePage: deletePage,
};
