var eventService = require("../services/event.service");
var cloudinaryUpload = require("../utils/cloudinary-upload");

async function uploadEventImage(req) {
  if (!req.file) {
    return;
  }

  if (!cloudinaryUpload.isCloudinaryConfigured()) {
    throw createHttpError(500, "Cloudinary environment variables are missing");
  }

  var result = await cloudinaryUpload.uploadBufferToCloudinary(
    req.file.buffer,
    {
      folder: "bistro-cafe/events",
      resource_type: "image",
    },
  );

  req.body.thumbnailUrl = result.secure_url;
}

async function getEvents(req, res, next) {
  try {
    var result = await eventService.getEvents(req.query || {});
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function getEventById(req, res, next) {
  try {
    var event = await eventService.getEventById(req.params.id);
    res.json({ data: event });
  } catch (error) {
    next(error);
  }
}

async function createEvent(req, res, next) {
  try {
    await uploadEventImage(req);
    var event = await eventService.createEvent(req.body);
    res.status(201).json({ data: event });
  } catch (error) {
    next(error);
  }
}

async function updateEvent(req, res, next) {
  try {
    await uploadEventImage(req);
    var event = await eventService.updateEvent(req.params.id, req.body);
    res.json({ data: event });
  } catch (error) {
    next(error);
  }
}

function createHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function deleteEvent(req, res, next) {
  try {
    await eventService.deleteEvent(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getEvents: getEvents,
  getEventById: getEventById,
  createEvent: createEvent,
  updateEvent: updateEvent,
  deleteEvent: deleteEvent,
};
