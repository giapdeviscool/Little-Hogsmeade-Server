var express = require("express");
var eventController = require("../controllers/event.controller");
var imageUpload = require("../middlewares/image-upload.middleware");

var router = express.Router();

router.use(authMiddleware.authenticate);
router.use(authMiddleware.verifyRole(['owner', 'chain admin', 'manager']));


router.get("/", eventController.getEvents);
router.get("/:id", eventController.getEventById);
router.post("/", imageUpload.singleImage("image"), eventController.createEvent);
router.patch(
  "/:id",
  imageUpload.singleImage("image"),
  eventController.updateEvent,
);
router.delete("/:id", eventController.deleteEvent);

module.exports = router;
