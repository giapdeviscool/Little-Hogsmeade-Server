var bannerService = require("../services/banner.service");
var cloudinaryUpload = require("../utils/cloudinary-upload");

async function uploadBannerImage(req) {
  if (!req.file) {
    return;
  }

  if (!cloudinaryUpload.isCloudinaryConfigured()) {
    throw createHttpError(500, "Cloudinary environment variables are missing");
  }

  var result = await cloudinaryUpload.uploadBufferToCloudinary(
    req.file.buffer,
    {
      folder: "bistro-cafe/banners",
      resource_type: "image",
    },
  );

  req.body.imageUrl = result.secure_url;
}

async function getBanners(req, res, next) {
  try {
    var result = await bannerService.getBanners(req.query || {});
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function getBannerById(req, res, next) {
  try {
    var banner = await bannerService.getBannerById(req.params.id);
    res.json({ data: banner });
  } catch (error) {
    next(error);
  }
}

async function createBanner(req, res, next) {
  try {
    await uploadBannerImage(req);
    var banner = await bannerService.createBanner(req.body);
    res.status(201).json({ data: banner });
  } catch (error) {
    next(error);
  }
}

async function updateBanner(req, res, next) {
  try {
    await uploadBannerImage(req);
    var banner = await bannerService.updateBanner(req.params.id, req.body);
    res.json({ data: banner });
  } catch (error) {
    next(error);
  }
}

function createHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function deleteBanner(req, res, next) {
  try {
    await bannerService.deleteBanner(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getBanners: getBanners,
  getBannerById: getBannerById,
  createBanner: createBanner,
  updateBanner: updateBanner,
  deleteBanner: deleteBanner,
};
