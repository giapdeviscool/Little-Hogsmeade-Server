var express = require("express");
var authRoutes = require("./auth.routes");
var userRoutes = require("./user.routes");
var branchRoutes = require("./branch.routes");
var chainRoutes = require("./chain.routes");
var promotionRoutes = require("./promotion.routes");
var employeeRoutes = require("./employee.routes");
var shiftRoutes = require("./shift.routes");
var rosterRoutes = require("./roster.routes");
var attendanceRoutes = require("./attendance.routes");
var payrollRoutes = require("./payroll.routes");
var pageRoutes = require("./page.routes");
var bannerRoutes = require("./banner.routes");
var postRoutes = require("./post.routes");
var eventRoutes = require("./event.routes");
var uploadRoutes = require("./upload.routes");
var menuItemRoutes = require("./menu-item.routes");
var categoryRoutes = require("./category.routes");
var toppingGroupRoutes = require("./topping-group.routes");
var resourcesConfig = require("../config/resources");
var createResourceRouter = require("./resource.routes");
var router = express.Router();
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/branches", branchRoutes);
router.use("/chain", chainRoutes);
router.use("/promotions", promotionRoutes);
router.use("/employees", employeeRoutes);
router.use("/shifts", shiftRoutes); // UC59
router.use("/rosters", rosterRoutes); // UC60
router.use("/attendance", attendanceRoutes); // UC61
router.use("/payroll", payrollRoutes); // UC62
router.use("/pages", pageRoutes);
router.use("/banners", bannerRoutes);
router.use("/posts", postRoutes);
router.use("/events", eventRoutes);
router.use("/uploads", uploadRoutes);
router.use("/menu-items", menuItemRoutes);
router.use("/categories", categoryRoutes);
router.use("/topping-groups", toppingGroupRoutes);

router.get("/resources", function (req, res) {
  res.json({
    data: resourcesConfig.getResources().map(function (resource) {
      return {
        name: resource.name,
        path: "/api/v1/" + resource.path,
        model: resource.model,
      };
    }),
  });
});

resourcesConfig.getResources().forEach(function (resource) {
  if (
    resource.name === "pages" ||
    resource.name === "banners" ||
    resource.name === "posts" ||
    resource.name === "events" ||
    resource.name === "menu_items" ||
    resource.name === "categories" ||
    resource.name === "topping_groups"
  ) {
    return;
  }

  var resourceRouter = createResourceRouter(resource);

  router.use("/" + resource.path, resourceRouter);

  if (resource.name !== resource.path) {
    router.use("/" + resource.name, resourceRouter);
  }
});

module.exports = router;
