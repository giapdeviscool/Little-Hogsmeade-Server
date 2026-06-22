var express = require("express");
var uploadController = require("../controllers/upload.controller");
var imageUpload = require("../middlewares/image-upload.middleware");

var router = express.Router();

router.post(
  "/image",
  imageUpload.singleImage("image"),
  uploadController.uploadImage,
);

module.exports = router;
