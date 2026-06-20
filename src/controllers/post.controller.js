var postService = require("../services/post.service");
var cloudinaryUpload = require("../utils/cloudinary-upload");

async function uploadPostImage(req) {
  if (!req.file) {
    return;
  }

  if (!cloudinaryUpload.isCloudinaryConfigured()) {
    throw createHttpError(500, "Cloudinary environment variables are missing");
  }

  var result = await cloudinaryUpload.uploadBufferToCloudinary(
    req.file.buffer,
    {
      folder: "bistro-cafe/posts",
      resource_type: "image",
    },
  );

  req.body.thumbnailUrl = result.secure_url;
}

async function getPosts(req, res, next) {
  try {
    var result = await postService.getPosts(req.query || {});
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function getPostById(req, res, next) {
  try {
    var post = await postService.getPostById(req.params.id);
    res.json({ data: post });
  } catch (error) {
    next(error);
  }
}

async function createPost(req, res, next) {
  try {
    await uploadPostImage(req);
    var post = await postService.createPost(req.body);
    res.status(201).json({ data: post });
  } catch (error) {
    next(error);
  }
}

async function updatePost(req, res, next) {
  try {
    await uploadPostImage(req);
    var post = await postService.updatePost(req.params.id, req.body);
    res.json({ data: post });
  } catch (error) {
    next(error);
  }
}

function createHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function deletePost(req, res, next) {
  try {
    await postService.deletePost(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPosts: getPosts,
  getPostById: getPostById,
  createPost: createPost,
  updatePost: updatePost,
  deletePost: deletePost,
};
