var menuItemRepository = require('../repositories/menu-item.repository');
var toppingGroupRepository = require('../repositories/topping-group.repository');

async function getMenuItemToppings(menuItemId, user) {
  var roleName = (user.roleName || '').trim().toLowerCase();
  var isAdmin = roleName.includes('chain admin') || roleName.includes('admin') || roleName.includes('manager');
  var isCashier = roleName.includes('cashier');
  
  var branchId = null;
  if (isAdmin || isCashier) {
    branchId = user.branchId;
  }

  var toppingGroups = await toppingGroupRepository.findToppingGroups(branchId);
  var assignments = await menuItemRepository.findCurrentToppingGroupAssignments(menuItemId);
  var assignedSet = new Set(assignments.map(function(a) { return a.toppingGroupId; }));

  return toppingGroups.map(function(tg) {
    return {
      id: tg.id,
      name: tg.name,
      minSelect: tg.minSelect,
      maxSelect: tg.maxSelect,
      toppingsCount: tg.toppings ? tg.toppings.length : 0,
      isAssigned: assignedSet.has(tg.id)
    };
  });
}

async function assignToppingGroups(menuItemId, toppingGroupIds, user) {
  var roleName = (user.roleName || '').trim().toLowerCase();
  var isAdmin = roleName.includes('chain admin') || roleName.includes('admin') || roleName.includes('manager');
  
  var menuItem = await menuItemRepository.findMenuItemById(menuItemId);
  if (!menuItem) {
    var errNotFound = new Error('Menu item not found.');
    errNotFound.status = 404;
    throw errNotFound;
  }

  if (isAdmin && menuItem.branchId === null) {
    var errAuth = new Error('Chain Admins cannot modify topping assignments of a globally synchronized menu item.');
    errAuth.status = 403;
    throw errAuth;
  }

  var branchId = null;
  if (isAdmin) {
    branchId = user.branchId;
  }
  var availableGroups = await toppingGroupRepository.findToppingGroups(branchId);
  var availableSet = new Set(availableGroups.map(function(g) { return g.id; }));
  
  for (var i = 0; i < toppingGroupIds.length; i++) {
    if (!availableSet.has(toppingGroupIds[i])) {
      var errTg = new Error('Cannot assign an inactive or inaccessible topping group.');
      errTg.status = 400;
      throw errTg;
    }
  }

  var currentAssignments = await menuItemRepository.findCurrentToppingGroupAssignments(menuItemId);
  var currentSet = new Set(currentAssignments.map(function(a) { return a.toppingGroupId; }));
  
  var newSet = new Set(toppingGroupIds);
  var toAdd = [];
  var toRemove = [];

  newSet.forEach(function(id) {
    if (!currentSet.has(id)) {
      toAdd.push(id);
    }
  });

  currentSet.forEach(function(id) {
    if (!newSet.has(id)) {
      toRemove.push(id);
    }
  });

  if (toRemove.length > 0) {
    await menuItemRepository.removeToppingGroupAssignments(menuItemId, toRemove);
  }
  if (toAdd.length > 0) {
    await menuItemRepository.assignToppingGroups(menuItemId, toAdd);
  }

  return { success: true, added: toAdd.length, removed: toRemove.length };
}

module.exports = {
  getMenuItemToppings: getMenuItemToppings,
  assignToppingGroups: assignToppingGroups
};
