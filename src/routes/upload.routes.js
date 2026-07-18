var express = require('express');
var authMiddleware = require('../middlewares/auth.middleware');
var uploadController = require("../controllers/upload.controller");
var imageUpload = require("../middlewares/image-upload.middleware");

var router = express.Router();

router.use(authMiddleware.authenticate);
router.use(authMiddleware.verifyRole(['owner', 'chain admin']));


router.post(
  "/image",
  imageUpload.singleImage("image"),
  uploadController.uploadImage,
);

module.exports = router;
