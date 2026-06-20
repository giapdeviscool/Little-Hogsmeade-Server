var express = require("express");
var postController = require("../controllers/post.controller");
var imageUpload = require("../middlewares/image-upload.middleware");

var router = express.Router();

router.get("/", postController.getPosts);
router.get("/:id", postController.getPostById);
router.post("/", imageUpload.singleImage("image"), postController.createPost);
router.patch(
  "/:id",
  imageUpload.singleImage("image"),
  postController.updatePost,
);
router.delete("/:id", postController.deletePost);

module.exports = router;
