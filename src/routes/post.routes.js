var express = require('express');
var authMiddleware = require('../middlewares/auth.middleware');
var postController = require("../controllers/post.controller");
var imageUpload = require("../middlewares/image-upload.middleware");

var router = express.Router();

router.get("/", postController.getPosts);
router.get("/:id", postController.getPostById);

router.use(authMiddleware.authenticate);
router.use(authMiddleware.verifyRole(['owner', 'chain admin']));

router.post("/", imageUpload.singleImage("image"), postController.createPost);
router.patch(
  "/:id",
  imageUpload.singleImage("image"),
  postController.updatePost,
);
router.delete("/:id", postController.deletePost);

module.exports = router;
