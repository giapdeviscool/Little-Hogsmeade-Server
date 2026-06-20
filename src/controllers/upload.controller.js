var cloudinaryUpload = require("../utils/cloudinary-upload");

async function uploadImage(req, res, next) {
  try {
    if (!cloudinaryUpload.isCloudinaryConfigured()) {
      throw createHttpError(
        500,
        "Cloudinary environment variables are missing",
      );
    }

    if (!req.file) {
      throw createHttpError(
        400,
        "No image file found. Send multipart/form-data with field name image.",
      );
    }

    var folder = req.body.folder || "bistro-cafe/test";
    var result = await cloudinaryUpload.uploadBufferToCloudinary(
      req.file.buffer,
      {
        folder: folder,
        resource_type: "image",
      },
    );

    res.status(201).json({
      message: "Image uploaded to Cloudinary successfully.",
      data: {
        public_id: result.public_id,
        secure_url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        created_at: result.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
}

function createHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports = {
  uploadImage: uploadImage,
};
