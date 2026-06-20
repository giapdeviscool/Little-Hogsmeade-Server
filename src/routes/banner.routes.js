var express = require("express");
var bannerController = require("../controllers/banner.controller");
var imageUpload = require("../middlewares/image-upload.middleware");

var router = express.Router();

router.get("/", bannerController.getBanners);
router.get("/:id", bannerController.getBannerById);
router.post(
  "/",
  imageUpload.singleImage("image"),
  bannerController.createBanner,
);
router.patch(
  "/:id",
  imageUpload.singleImage("image"),
  bannerController.updateBanner,
);
router.delete("/:id", bannerController.deleteBanner);

module.exports = router;
