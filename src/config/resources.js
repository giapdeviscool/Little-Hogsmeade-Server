var resources = [
  { name: 'branches', path: 'branches', model: 'Branch', delegate: 'branch' },
  { name: 'branch_configs', path: 'branch-configs', model: 'BranchConfig', delegate: 'branchConfig' },
  { name: 'roles', path: 'roles', model: 'Role', delegate: 'role' },
  { name: 'employees', path: 'employees', model: 'Employee', delegate: 'employee' },
  { name: 'shifts', path: 'shifts', model: 'Shift', delegate: 'shift' },
  { name: 'timesheets', path: 'timesheets', model: 'Timesheet', delegate: 'timesheet' },
  { name: 'categories', path: 'categories', model: 'Category', delegate: 'category' },
  { name: 'menu_items', path: 'menu-items', model: 'MenuItem', delegate: 'menuItem' },
  { name: 'menu_item_variants', path: 'menu-item-variants', model: 'MenuItemVariant', delegate: 'menuItemVariant' },
  { name: 'topping_groups', path: 'topping-groups', model: 'ToppingGroup', delegate: 'toppingGroup' },
  { name: 'toppings', path: 'toppings', model: 'Topping', delegate: 'topping' },
  { name: 'menu_item_topping_groups', path: 'menu-item-topping-groups', model: 'MenuItemToppingGroup', delegate: 'menuItemToppingGroup' },
  { name: 'ingredients', path: 'ingredients', model: 'Ingredient', delegate: 'ingredient' },
  { name: 'recipes', path: 'recipes', model: 'Recipe', delegate: 'recipe' },
  { name: 'areas', path: 'areas', model: 'Area', delegate: 'area' },
  { name: 'tables', path: 'tables', model: 'Table', delegate: 'table' },
  { name: 'customers', path: 'customers', model: 'Customer', delegate: 'customer' },
  { name: 'membership_tiers', path: 'membership-tiers', model: 'MembershipTier', delegate: 'membershipTier' },
  { name: 'customer_memberships', path: 'customer-memberships', model: 'CustomerMembership', delegate: 'customerMembership' },
  { name: 'loyalty_configs', path: 'loyalty-configs', model: 'LoyaltyConfig', delegate: 'loyaltyConfig' },
  { name: 'point_transactions', path: 'point-transactions', model: 'PointTransaction', delegate: 'pointTransaction' },
  { name: 'orders', path: 'orders', model: 'Order', delegate: 'order' },
  { name: 'order_items', path: 'order-items', model: 'OrderItem', delegate: 'orderItem' },
  { name: 'order_item_toppings', path: 'order-item-toppings', model: 'OrderItemTopping', delegate: 'orderItemTopping' },
  { name: 'invoices', path: 'invoices', model: 'Invoice', delegate: 'invoice' },
  { name: 'payments', path: 'payments', model: 'Payment', delegate: 'payment' },
  { name: 'delivery_orders', path: 'delivery-orders', model: 'DeliveryOrder', delegate: 'deliveryOrder' },
  { name: 'stock_transactions', path: 'stock-transactions', model: 'StockTransaction', delegate: 'stockTransaction' },
  { name: 'purchase_orders', path: 'purchase-orders', model: 'PurchaseOrder', delegate: 'purchaseOrder' },
  { name: 'purchase_order_items', path: 'purchase-order-items', model: 'PurchaseOrderItem', delegate: 'purchaseOrderItem' },
  { name: 'expense_categories', path: 'expense-categories', model: 'ExpenseCategory', delegate: 'expenseCategory' },
  { name: 'expenses', path: 'expenses', model: 'Expense', delegate: 'expense' },
  { name: 'campaigns', path: 'campaigns', model: 'Campaign', delegate: 'campaign' },
  { name: 'vouchers', path: 'vouchers', model: 'Voucher', delegate: 'voucher' },
  { name: 'voucher_usages', path: 'voucher-usages', model: 'VoucherUsage', delegate: 'voucherUsage' },
  { name: 'pages', path: 'pages', model: 'Page', delegate: 'page' },
  { name: 'banners', path: 'banners', model: 'Banner', delegate: 'banner' },
  { name: 'posts', path: 'posts', model: 'Post', delegate: 'post' },
  { name: 'events', path: 'events', model: 'Event', delegate: 'event' },
  { name: 'reservations', path: 'reservations', model: 'Reservation', delegate: 'reservation' }
];

function getResources() {
  return resources.slice();
}

function getResourceByPath(path) {
  return resources.find(function(resource) {
    return resource.path === path;
  });
}

module.exports = {
  getResources: getResources,
  getResourceByPath: getResourceByPath
};
