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
var orderRoutes = require("./order.routes");
var invoiceRoutes = require("./invoice.routes");
var menuItemRoutes = require("./menu-item.routes");
var categoryRoutes = require("./category.routes");
var toppingGroupRoutes = require("./topping-group.routes");
var recipeRoutes = require("./recipe.routes");
var ingredientRoutes = require("./ingredient.routes");
var tableRoutes = require("./table.routes");
var reservationRoutes = require("./reservation.routes");
var preparationRoutes = require("./preparation.routes");
var stockConversionRoutes = require("./stock-conversion.routes");
var customerRoutes = require("./customer.routes");
var adminRoutes = require("./admin.routes");
var deliveryRoutes = require("./delivery.routes");
var deliveryController = require("../controllers/delivery.controller");
var authMiddleware = require("../middlewares/auth.middleware");
var preparationRoutes = require("./preparation.routes");
var stockConversionRoutes = require("./stock-conversion.routes");
var cashierShiftRoutes = require("./cashier-shift.routes");
var paymentRoutes = require("./payment.routes");
var otpRoutes = require("./otp.routes");
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
router.use("/orders", orderRoutes);
router.use("/invoices", invoiceRoutes);
router.use("/menu-items", menuItemRoutes);
router.use("/categories", categoryRoutes);
router.use("/topping-groups", toppingGroupRoutes);
router.use("/recipes", recipeRoutes);
router.use("/ingredients", ingredientRoutes);
router.use("/tables", tableRoutes);
router.use("/reservations", reservationRoutes);
router.use("/cashier-shifts", cashierShiftRoutes);
router.use("/payments", paymentRoutes);
router.use("/preparations", preparationRoutes);
router.use("/stock-conversions", stockConversionRoutes);
router.use("/customers", customerRoutes);
router.use("/admin", adminRoutes);
router.use("/delivery/orders", deliveryRoutes);
router.post("/pos/orders/delivery", authMiddleware.authenticate, deliveryController.createDeliveryOrder);
router.use("/preparations", preparationRoutes);
router.use("/stock-conversions", stockConversionRoutes);
router.use("/otp", otpRoutes);

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
  var excludedResources = [
    "pages",
    "banners",
    "posts",
    "events",
    "menu_items",
    "categories",
    "topping_groups",
    "ingredients",
    "customers"
  ];
  if (excludedResources.includes(resource.name)) {
    return;
  }

  var resourceRouter = createResourceRouter(resource);

  router.use("/" + resource.path, resourceRouter);

  if (resource.name !== resource.path) {
    router.use("/" + resource.name, resourceRouter);
  }
});

module.exports = router;
