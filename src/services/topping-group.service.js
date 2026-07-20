var toppingGroupRepository = require('../repositories/topping-group.repository');

async function getToppingGroups(query, user) {
  var roleName = (user.roleName || '').trim().toLowerCase();
  var isOwner = roleName.includes('owner');
  var branchId = null;
  
  if (isOwner) {
    if (query.branchId && query.branchId !== '') {
      branchId = query.branchId;
    }
  } else {
    branchId = user.branchId;
  }
  
  return await toppingGroupRepository.findToppingGroups(branchId);
}

async function createToppingGroup(data, user) {
  var roleName = user.roleName || '';
  
  if (data.minSelect < 0) data.minSelect = 0;
  if (data.maxSelect < data.minSelect) {
    var errRule = new Error('Maximum selection limit must be greater than or equal to minimum.');
    errRule.status = 400;
    throw errRule;
  }

  var toppingNames = new Set();
  if (data.toppings && data.toppings.length > 0) {
    for (var i = 0; i < data.toppings.length; i++) {
      var top = data.toppings[i];
      if (!top.name || top.name.trim() === '') {
        var errName = new Error('Option names must not be empty.');
        errName.status = 400;
        throw errName;
      }
      if (top.extraPrice < 0) {
        var errPrice = new Error('Extra prices must be valid non-negative integers.');
        errPrice.status = 400;
        throw errPrice;
      }
      if (toppingNames.has(top.name.toLowerCase())) {
        var errDup = new Error('Option names must be unique within this group.');
        errDup.status = 400;
        throw errDup;
      }
      toppingNames.add(top.name.toLowerCase());
    }
  }

  var branchId = null;
  if (roleName === 'Chain Admin') {
    branchId = user.branchId;
  } else if (roleName === 'Owner' || roleName === 'Chain Owner') {
    branchId = null; // Global
  }

  var toppingGroupData = {
    name: data.name,
    isRequired: data.isRequired || false,
    minSelect: data.minSelect,
    maxSelect: data.maxSelect,
    branchId: branchId,
    isActive: true,
    toppings: {
      create: data.toppings.map(function(t) {
        return {
          name: t.name,
          extraPrice: t.extraPrice,
          isActive: true
        };
      })
    }
  };

  return await toppingGroupRepository.createToppingGroup(toppingGroupData);
}

async function softDeleteToppingGroup(id, user) {
  var roleName = user.roleName || '';
  var group = await toppingGroupRepository.findToppingGroupById(id);
  
  if (!group) {
    var errNotFound = new Error('Topping group not found.');
    errNotFound.status = 404;
    throw errNotFound;
  }

  if (roleName === 'Chain Admin' && group.branchId === null) {
    var errAuth = new Error('Chain Admins cannot modify globally synchronized topping groups.');
    errAuth.status = 403;
    throw errAuth;
  }

  var activeMenuItemCount = await toppingGroupRepository.countMenuItemToppingGroups(id);
  if (activeMenuItemCount > 0) {
    var errAssigned = new Error('This topping group is mapped to active menu items. Please unassign it from the items before deactivating.');
    errAssigned.status = 400;
    throw errAssigned;
  }

  return await toppingGroupRepository.softDeleteToppingGroup(id);
}

async function updateToppingGroup(id, data, user) {
  var roleName = user.roleName || '';
  var group = await toppingGroupRepository.findToppingGroupById(id);
  
  if (!group) {
    var errNotFound = new Error('Topping group not found.');
    errNotFound.status = 404;
    throw errNotFound;
  }

  if (roleName === 'Chain Admin' && group.branchId === null) {
    var errAuth = new Error('Chain Admins cannot modify globally synchronized topping groups.');
    errAuth.status = 403;
    throw errAuth;
  }

  if (data.minSelect < 0) data.minSelect = 0;
  if (data.maxSelect < data.minSelect) {
    var errRule = new Error('Maximum selection limit must be greater than or equal to minimum.');
    errRule.status = 400;
    throw errRule;
  }

  var toppingNames = new Set();
  if (data.toppings && data.toppings.length > 0) {
    for (var i = 0; i < data.toppings.length; i++) {
      var top = data.toppings[i];
      if (!top.name || top.name.trim() === '') {
        var errName = new Error('Option names must not be empty.');
        errName.status = 400;
        throw errName;
      }
      if (top.extraPrice < 0) {
        var errPrice = new Error('Extra prices must be valid non-negative integers.');
        errPrice.status = 400;
        throw errPrice;
      }
      if (toppingNames.has(top.name.toLowerCase())) {
        var errDup = new Error('Option names must be unique within this group.');
        errDup.status = 400;
        throw errDup;
      }
      toppingNames.add(top.name.toLowerCase());
    }
  }

  var toppingGroupData = {
    name: data.name,
    isRequired: data.isRequired || false,
    minSelect: data.minSelect,
    maxSelect: data.maxSelect,
    toppings: {
      updateMany: {
        where: {},
        data: { isActive: false }
      },
      create: data.toppings.map(function(t) {
        return {
          name: t.name,
          extraPrice: t.extraPrice,
          isActive: true
        };
      })
    }
  };

  return await toppingGroupRepository.updateToppingGroup(id, toppingGroupData);
}

module.exports = {
  getToppingGroups: getToppingGroups,
  createToppingGroup: createToppingGroup,
  updateToppingGroup: updateToppingGroup,
  softDeleteToppingGroup: softDeleteToppingGroup
};
