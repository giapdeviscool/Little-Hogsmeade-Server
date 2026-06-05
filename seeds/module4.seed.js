var crypto = require('crypto');
var env = require('../src/config/env');
var prisma = require('../src/lib/prisma');

var PASSWORD = 'Module4!2026';
var PREFIX = 'M4 - ';
var NOW = new Date();

function main() {
  return Promise.resolve()
    .then(function() {
      validateDatabaseUrl();

      return prisma.$transaction(async function(tx) {
        var chainConfig = await seedChainConfig(tx);
        var roles = await seedRoles(tx);
        var branches = await seedBranches(tx);
        var employees = await seedEmployees(tx, branches, roles);
        var standardCategories = await seedStandardCategories(tx);
        var standardMenuItems = await seedStandardMenuItems(tx, standardCategories);
        await syncBranchesMenu(tx, branches.active, standardCategories, standardMenuItems);
        await seedBranchSafetyData(tx, branches, employees);
        await seedPromotions(tx, branches);

        return {
          chainConfig: chainConfig,
          branches: branches,
          employees: employees,
          categories: standardCategories.length,
          menuItems: standardMenuItems.length
        };
      },
    {
      maxWait: 10000, // default is 2000
      timeout: 60000, // default is 5000
    }
    );
    })
    .then(function(result) {
      console.log('[seed] Module 4 seed completed');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(function(error) {
      console.error('[seed] Module 4 seed failed');
      console.error(error.message || error);
      process.exitCode = 1;
    })
    .finally(function() {
      return prisma.$disconnect();
    },
  );
}

function validateDatabaseUrl() {
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL is required before running Module 4 seed.');
  }

  var parsedUrl;

  try {
    parsedUrl = new URL(env.databaseUrl);
  } catch (error) {
    throw new Error('DATABASE_URL must be a valid MongoDB connection string.');
  }

  if (parsedUrl.protocol !== 'mongodb:' && parsedUrl.protocol !== 'mongodb+srv:') {
    throw new Error('DATABASE_URL must start with mongodb:// or mongodb+srv://.');
  }

  if (!parsedUrl.pathname || parsedUrl.pathname === '/') {
    throw new Error('DATABASE_URL must include a database name, for example mongodb+srv://user:pass@cluster.mongodb.net/little-hogsmeade?retryWrites=true&w=majority.');
  }
}

async function seedChainConfig(tx) {
  var existing = await tx.chainConfig.findFirst();
  var data = {
    loyaltyEarnRate: 1.25,
    globalPricingEnabled: true,
    defaultCurrency: 'VND'
  };

  if (existing) {
    return tx.chainConfig.update({
      where: { id: existing.id },
      data: data
    });
  }

  return tx.chainConfig.create({ data: data });
}

async function seedRoles(tx) {
  var owner = await upsertByName(tx.role, 'name', PREFIX + 'Chain Owner', {
    permissions: {
      module4: ['dashboard', 'branches', 'chain-config', 'promotions', 'pricing', 'sync-menu']
    }
  });
  var admin = await upsertByName(tx.role, 'name', PREFIX + 'Chain Admin', {
    permissions: {
      module4: ['dashboard', 'branches', 'promotions']
    }
  });

  return {
    owner: owner,
    admin: admin
  };
}

async function seedBranches(tx) {
  var branches = [
    {
      name: PREFIX + 'Little Hogsmeade Flagship',
      address: '12 Orchard Lane, District 1, Ho Chi Minh City',
      phone: '0901001001',
      email: 'flagship@little-hogsmeade.test',
      lat: 10.7758,
      lng: 106.7009,
      openTime: atTime(7, 0),
      closeTime: atTime(22, 0),
      status: 'active',
      allowLocalPricingOverride: true
    },
    {
      name: PREFIX + 'Riverside Branch',
      address: '48 Riverside Road, District 2, Ho Chi Minh City',
      phone: '0901001002',
      email: 'riverside@little-hogsmeade.test',
      lat: 10.7876,
      lng: 106.7302,
      openTime: atTime(7, 30),
      closeTime: atTime(21, 30),
      status: 'active',
      allowLocalPricingOverride: false
    },
    {
      name: PREFIX + 'Hidden Garden Branch',
      address: '8 Hidden Garden Street, District 3, Ho Chi Minh City',
      phone: '0901001003',
      email: 'garden@little-hogsmeade.test',
      lat: 10.7811,
      lng: 106.6856,
      openTime: atTime(8, 0),
      closeTime: atTime(21, 0),
      status: 'inactive',
      allowLocalPricingOverride: false
    }
  ];
  var created = [];

  for (var i = 0; i < branches.length; i += 1) {
    created.push(await upsertBranch(tx, branches[i]));
  }

  return {
    active: created.filter(function(branch) {
      return branch.status === 'active';
    }),
    inactive: created.filter(function(branch) {
      return branch.status !== 'active';
    })
  };
}

async function seedEmployees(tx, branches, roles) {
  var ownerBranch = branches.active[0];
  var adminBranch = branches.active[1] || branches.active[0];
  var owner = await upsertEmployee(tx, {
    phone: '0902001001',
    fullName: PREFIX + 'Owner',
    email: 'owner@little-hogsmeade.test',
    branchId: ownerBranch.id,
    roleId: roles.owner.id,
    hiredDate: atDate(2026, 1, 5),
    pinCode: '1001',
    status: 'active'
  });
  var admin = await upsertEmployee(tx, {
    phone: '0902001002',
    fullName: PREFIX + 'Admin',
    email: 'admin@little-hogsmeade.test',
    branchId: adminBranch.id,
    roleId: roles.admin.id,
    hiredDate: atDate(2026, 1, 8),
    pinCode: '1002',
    status: 'active'
  });

  return {
    owner: owner,
    admin: admin
  };
}

async function seedStandardCategories(tx) {
  var categories = [
    { name: PREFIX + 'Coffee', icon: 'coffee', displayOrder: 1, isActive: true },
    { name: PREFIX + 'Tea', icon: 'leaf', displayOrder: 2, isActive: true },
    { name: PREFIX + 'Bakery', icon: 'croissant', displayOrder: 3, isActive: true }
  ];
  var created = [];

  for (var i = 0; i < categories.length; i += 1) {
    created.push(await upsertCategory(tx, null, categories[i]));
  }

  return created;
}

async function seedStandardMenuItems(tx, categories) {
  var coffeeCategory = findCategory(categories, PREFIX + 'Coffee');
  var teaCategory = findCategory(categories, PREFIX + 'Tea');
  var bakeryCategory = findCategory(categories, PREFIX + 'Bakery');
  var items = [
    {
      name: PREFIX + 'Espresso',
      categoryId: coffeeCategory.id,
      description: 'Single shot espresso for the morning rush.',
      imageUrl: null,
      basePrice: 39000,
      isActive: true,
      isFeatured: true,
      itemType: 'beverage',
      variants: [
        { name: 'Hot', priceAdjustment: 0 },
        { name: 'Iced', priceAdjustment: 5000 }
      ]
    },
    {
      name: PREFIX + 'Latte',
      categoryId: coffeeCategory.id,
      description: 'Creamy espresso with steamed milk.',
      imageUrl: null,
      basePrice: 49000,
      isActive: true,
      isFeatured: true,
      itemType: 'beverage',
      variants: [
        { name: 'Hot', priceAdjustment: 0 },
        { name: 'Oat Milk', priceAdjustment: 7000 }
      ]
    },
    {
      name: PREFIX + 'Jasmine Tea',
      categoryId: teaCategory.id,
      description: 'Fragrant tea served hot or iced.',
      imageUrl: null,
      basePrice: 35000,
      isActive: true,
      isFeatured: false,
      itemType: 'beverage',
      variants: [
        { name: 'Hot', priceAdjustment: 0 },
        { name: 'Iced', priceAdjustment: 3000 }
      ]
    },
    {
      name: PREFIX + 'Butter Croissant',
      categoryId: bakeryCategory.id,
      description: 'Warm butter croissant with a crisp shell.',
      imageUrl: null,
      basePrice: 42000,
      isActive: true,
      isFeatured: false,
      itemType: 'food',
      variants: [
        { name: 'Plain', priceAdjustment: 0 }
      ]
    }
  ];
  var created = [];

  for (var i = 0; i < items.length; i += 1) {
    created.push(await upsertMenuItem(tx, null, items[i]));
  }

  return created;
}

async function syncBranchesMenu(tx, activeBranches, standardCategories, standardMenuItems) {
  for (var i = 0; i < activeBranches.length; i += 1) {
    var branch = activeBranches[i];
    var branchCategoryMap = {};

    for (var j = 0; j < standardCategories.length; j += 1) {
      var branchCategory = await upsertCategory(tx, branch.id, {
        name: standardCategories[j].name,
        icon: standardCategories[j].icon,
        displayOrder: standardCategories[j].displayOrder,
        isActive: standardCategories[j].isActive
      });

      branchCategoryMap[standardCategories[j].id] = branchCategory.id;
    }

    for (var k = 0; k < standardMenuItems.length; k += 1) {
      var sourceItem = standardMenuItems[k];
      var mappedCategoryId = branchCategoryMap[sourceItem.categoryId];

      await upsertMenuItem(tx, branch.id, {
        name: sourceItem.name,
        categoryId: mappedCategoryId,
        description: sourceItem.description,
        imageUrl: sourceItem.imageUrl,
        basePrice: sourceItem.basePrice,
        isActive: sourceItem.isActive,
        isFeatured: sourceItem.isFeatured,
        itemType: sourceItem.itemType,
        variants: sourceItem.menuItemVariants.map(function(variant) {
          return {
            name: variant.name,
            priceAdjustment: variant.priceAdjustment
          };
        })
      });
    }
  }
}

async function seedBranchSafetyData(tx, branches, employees) {
  var lockedBranch = branches.active[0];
  var tester = employees.owner;
  var seedNote = PREFIX + 'deactivate-check';

  await deleteSeededOrdersAndReservations(tx, seedNote, lockedBranch.id);

  await upsertOrder(tx, {
    note: seedNote,
    branchId: lockedBranch.id,
    employeeId: tester.id,
    orderType: 'dine-in',
    status: 'pending'
  });

  await upsertReservation(tx, {
    note: seedNote,
    branchId: lockedBranch.id,
    guestName: PREFIX + 'Reserved Guest',
    guestPhone: '0903001001',
    guestCount: 4,
    reservedDate: atDate(2026, 6, 8),
    reservedTime: atTime(18, 0),
    status: 'reserved'
  });
}

async function seedPromotions(tx, branches) {
  var promotionData = [
    {
      name: PREFIX + 'Chain Welcome Week',
      description: '10% off for all active branches during launch week.',
      startDate: atDate(2026, 6, 1),
      endDate: atDate(2026, 6, 15),
      discountValue: 10,
      discountType: 'percent',
      scope: 'global',
      appliedBranches: [],
      branchId: null,
      isActive: true
    },
    {
      name: PREFIX + 'Riverside Lunch Combo',
      description: 'Fixed discount for the Riverside branch lunch hour.',
      startDate: atDate(2026, 6, 1),
      endDate: atDate(2026, 6, 30),
      discountValue: 25000,
      discountType: 'fixed',
      scope: 'specific',
      appliedBranches: [branches.active[1].id],
      branchId: branches.active[1].id,
      isActive: true
    }
  ];

  for (var i = 0; i < promotionData.length; i += 1) {
    await upsertCampaign(tx, promotionData[i]);
  }
}

async function upsertBranch(tx, data) {
  var existing = await tx.branch.findFirst({
    where: { name: data.name }
  });

  if (existing) {
    return tx.branch.update({
      where: { id: existing.id },
      data: data
    });
  }

  return tx.branch.create({ data: data });
}

async function upsertEmployee(tx, data) {
  var existing = await tx.employee.findFirst({
    where: {
      OR: [
        { phone: data.phone },
        { email: data.email }
      ]
    }
  });
  var payload = Object.assign({}, data, {
    passwordHash: hashPassword(PASSWORD)
  });

  if (existing) {
    return tx.employee.update({
      where: { id: existing.id },
      data: payload
    });
  }

  return tx.employee.create({ data: payload });
}

async function upsertCategory(tx, branchId, data) {
  var existing = await tx.category.findFirst({
    where: {
      branchId: branchId,
      name: data.name
    }
  });
  var payload = {
    branchId: branchId,
    name: data.name,
    icon: data.icon,
    displayOrder: data.displayOrder,
    isActive: data.isActive
  };

  if (existing) {
    return tx.category.update({
      where: { id: existing.id },
      data: payload
    });
  }

  return tx.category.create({ data: payload });
}

async function upsertMenuItem(tx, branchId, data) {
  var existing = await tx.menuItem.findFirst({
    where: {
      branchId: branchId,
      name: data.name
    }
  });
  var payload = {
    branchId: branchId,
    categoryId: data.categoryId,
    name: data.name,
    description: data.description || null,
    imageUrl: data.imageUrl || null,
    basePrice: data.basePrice,
    isActive: data.isActive,
    isFeatured: data.isFeatured,
    itemType: data.itemType
  };
  var item;

  if (existing) {
    item = await tx.menuItem.update({
      where: { id: existing.id },
      data: payload
    });
  } else {
    item = await tx.menuItem.create({ data: payload });
  }

  await tx.menuItemVariant.deleteMany({
    where: { menuItemId: item.id }
  });

  if (data.variants && data.variants.length > 0) {
    for (var i = 0; i < data.variants.length; i += 1) {
      await tx.menuItemVariant.create({
        data: {
          menuItemId: item.id,
          name: data.variants[i].name,
          priceAdjustment: data.variants[i].priceAdjustment
        }
      });
    }
  }

  return tx.menuItem.findUnique({
    where: { id: item.id },
    include: { menuItemVariants: true }
  });
}

async function upsertCampaign(tx, data) {
  var existing = await tx.campaign.findFirst({
    where: { name: data.name }
  });
  var payload = {
    branchId: data.branchId,
    name: data.name,
    description: data.description,
    startDate: data.startDate,
    endDate: data.endDate,
    discountValue: data.discountValue,
    discountType: data.discountType,
    scope: data.scope,
    appliedBranches: data.appliedBranches,
    isActive: data.isActive
  };

  if (existing) {
    return tx.campaign.update({
      where: { id: existing.id },
      data: payload
    });
  }

  return tx.campaign.create({ data: payload });
}

async function upsertOrder(tx, data) {
  var existing = await tx.order.findFirst({
    where: {
      branchId: data.branchId,
      note: data.note
    }
  });

  if (existing) {
    return tx.order.update({
      where: { id: existing.id },
      data: {
        employeeId: data.employeeId,
        orderType: data.orderType,
        status: data.status
      }
    });
  }

  return tx.order.create({ data: data });
}

async function upsertReservation(tx, data) {
  var existing = await tx.reservation.findFirst({
    where: {
      branchId: data.branchId,
      note: data.note
    }
  });

  if (existing) {
    return tx.reservation.update({
      where: { id: existing.id },
      data: data
    });
  }

  return tx.reservation.create({ data: data });
}

async function deleteSeededOrdersAndReservations(tx, note, branchId) {
  var orders = await tx.order.findMany({
    where: {
      branchId: branchId,
      note: note
    },
    select: { id: true }
  });
  var orderIds = orders.map(function(order) {
    return order.id;
  });

  if (orderIds.length > 0) {
    await tx.orderItem.deleteMany({
      where: { orderId: { in: orderIds } }
    });
    await tx.invoice.deleteMany({
      where: { orderId: { in: orderIds } }
    });
    await tx.deliveryOrder.deleteMany({
      where: { orderId: { in: orderIds } }
    });
    await tx.voucherUsage.deleteMany({
      where: { orderId: { in: orderIds } }
    });
    await tx.pointTransaction.deleteMany({
      where: { orderId: { in: orderIds } }
    });
    await tx.order.deleteMany({
      where: { id: { in: orderIds } }
    });
  }

  await tx.reservation.deleteMany({
    where: {
      branchId: branchId,
      note: note
    }
  });
}

async function upsertByName(delegate, field, name, data) {
  var existing = await delegate.findFirst({
    where: {
      [field]: name
    }
  });

  if (existing) {
    return delegate.update({
      where: { id: existing.id },
      data: Object.assign({}, data, { [field]: name })
    });
  }

  return delegate.create({
    data: Object.assign({}, data, { [field]: name })
  });
}

function findCategory(categories, name) {
  for (var i = 0; i < categories.length; i += 1) {
    if (categories[i].name === name) {
      return categories[i];
    }
  }

  throw new Error('Category not found: ' + name);
}

function hashPassword(password) {
  var salt = crypto.createHash('sha256').update(password + ':module4').digest('hex').slice(0, 32);
  var hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function atDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function atTime(hour, minute) {
  return new Date(Date.UTC(2026, 0, 1, hour, minute, 0, 0));
}

main();
