var multer = require("multer");
var path = require("path");

var allowedTypes = /jpeg|jpg|png|gif|webp/;

var memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    var extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    var mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }

    cb(new Error("Only images are allowed (jpeg, jpg, png, gif, webp)."));
  },
});

function singleImage(fieldName) {
  return memoryUpload.single(fieldName || "image");
}

module.exports = {
  singleImage: singleImage,
};
