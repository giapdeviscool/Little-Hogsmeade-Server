var express = require("express");
var pageController = require("../controllers/page.controller");

var router = express.Router();

router.get("/", pageController.getPages);
router.get("/:id", pageController.getPageById);
router.post("/", pageController.createPage);
router.patch("/:id", pageController.updatePage);
router.delete("/:id", pageController.deletePage);

module.exports = router;
