var cloudinary = require("../config/cloudinary");

function uploadBufferToCloudinary(buffer, options) {
  return new Promise(function (resolve, reject) {
    var uploadOptions = options || {};

    var stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      function (error, result) {
        if (error) {
          return reject(error);
        }

        resolve(result);
      },
    );

    stream.end(buffer);
  });
}

function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );
}

module.exports = {
  uploadBufferToCloudinary: uploadBufferToCloudinary,
  isCloudinaryConfigured: isCloudinaryConfigured,
};
