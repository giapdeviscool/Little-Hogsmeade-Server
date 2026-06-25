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
        var customerData = await seedCustomersAndOrders(tx, branches, employees);
        await seedDeliveryOrders(tx, branches, employees);

        return {
          chainConfig: chainConfig,
          branches: branches,
          employees: employees,
          categories: standardCategories.length,
          menuItems: standardMenuItems.length,
          customer: customerData
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
  var shipper = await upsertByName(tx.role, 'name', PREFIX + 'Shipper', {
    permissions: {
      module4: ['delivery']
    }
  });

  return {
    owner: owner,
    admin: admin,
    shipper: shipper
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

  // Seed Shippers
  var shipper1 = await upsertEmployee(tx, {
    phone: '0909001001',
    fullName: PREFIX + 'Shipper Nguyễn Văn Tèo',
    email: 'teo.shipper@little-hogsmeade.test',
    branchId: ownerBranch.id,
    roleId: roles.shipper.id,
    hiredDate: atDate(2026, 2, 1),
    pinCode: '2001',
    status: 'active'
  });
  var shipper2 = await upsertEmployee(tx, {
    phone: '0909001002',
    fullName: PREFIX + 'Shipper Trần Thị Tí',
    email: 'ti.shipper@little-hogsmeade.test',
    branchId: ownerBranch.id,
    roleId: roles.shipper.id,
    hiredDate: atDate(2026, 2, 5),
    pinCode: '2002',
    status: 'active'
  });
  var shipper3 = await upsertEmployee(tx, {
    phone: '0909001003',
    fullName: PREFIX + 'Shipper Lê Văn Hải',
    email: 'hai.shipper@little-hogsmeade.test',
    branchId: ownerBranch.id,
    roleId: roles.shipper.id,
    hiredDate: atDate(2026, 2, 10),
    pinCode: '2003',
    status: 'active'
  });

  return {
    owner: owner,
    admin: admin,
    shippers: [shipper1, shipper2, shipper3]
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

async function seedMembershipTiers(tx) {
  var tiers = [
    { name: 'Bronze', minPoints: 0, discountPercent: 0, description: 'Thành viên Đồng' },
    { name: 'Silver', minPoints: 50, discountPercent: 5, description: 'Thành viên Bạc' },
    { name: 'Gold', minPoints: 100, discountPercent: 10, description: 'Thành viên Vàng' },
    { name: 'Platinum', minPoints: 200, discountPercent: 15, description: 'Thành viên Bạch Kim' }
  ];
  var seededTiers = {};
  for (var i = 0; i < tiers.length; i++) {
    var t = tiers[i];
    var existing = await tx.membershipTier.findFirst({
      where: { name: t.name }
    });
    if (existing) {
      seededTiers[t.name.toLowerCase()] = existing;
    } else {
      var created = await tx.membershipTier.create({
        data: t
      });
      seededTiers[t.name.toLowerCase()] = created;
    }
  }
  return seededTiers;
}

async function createSeededOrder(tx, data) {
  var order = await tx.order.create({
    data: {
      branchId: data.branchId,
      customerId: data.customerId,
      employeeId: data.employeeId,
      orderType: data.orderType || 'dine-in',
      status: data.status,
      createdAt: data.createdAt,
      updatedAt: data.createdAt
    }
  });

  for (var i = 0; i < data.items.length; i++) {
    var item = data.items[i];
    await tx.orderItem.create({
      data: {
        orderId: order.id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.quantity * item.unitPrice,
        status: 'completed'
      }
    });
  }

  var invoiceStatus = data.status === 'paid' || data.status === 'completed' ? 'paid' : 'pending';
  var paymentStatus = data.status === 'paid' || data.status === 'completed' ? 'success' : 'pending';

  var invoice = await tx.invoice.create({
    data: {
      orderId: order.id,
      subtotal: data.totalAmount,
      discountAmount: data.discountAmount,
      taxAmount: 0,
      totalAmount: data.finalAmount,
      status: invoiceStatus,
      createdAt: data.createdAt
    }
  });

  await tx.payment.create({
    data: {
      invoiceId: invoice.id,
      method: 'cash',
      amount: data.finalAmount,
      status: paymentStatus,
      paidAt: data.status === 'paid' || data.status === 'completed' ? data.createdAt : null
    }
  });

  return order;
}

async function seedCustomersAndOrders(tx, branches, employees) {
  var seededTiers = await seedMembershipTiers(tx);

  var latte = await tx.menuItem.findFirst({ where: { name: { contains: 'Latte', mode: 'insensitive' } } });
  var croissant = await tx.menuItem.findFirst({ where: { name: { contains: 'Croissant', mode: 'insensitive' } } });
  var espresso = await tx.menuItem.findFirst({ where: { name: { contains: 'Espresso', mode: 'insensitive' } } });
  var tea = await tx.menuItem.findFirst({ where: { name: { contains: 'Tea', mode: 'insensitive' } } });
  var menuItems = await tx.menuItem.findMany({ take: 3 });

  var menuItemsList = {
    latte: latte || menuItems[0],
    croissant: croissant || menuItems[1] || menuItems[0],
    espresso: espresso || menuItems[2] || menuItems[0],
    tea: tea || menuItems[0],
    default: menuItems[0]
  };

  var customersData = [
    {
      phone: '0987654321',
      fullName: 'Nguyễn Văn A',
      email: 'nguyenvana@gmail.com',
      birthday: '1995-08-15',
      tier: 'gold',
      points: 250,
      spent: 5500000.00,
      source: 'walk-in',
      joinedAt: '2025-10-15T08:30:00Z',
      orders: [
        {
          branchIndex: 0,
          createdAt: '2026-06-20T19:45:00Z',
          totalAmount: 150000.00,
          discountAmount: 0.00,
          finalAmount: 150000.00,
          pointsEarned: 0,
          items: [{ menuItemName: 'latte', quantity: 1, unitPrice: 150000.00 }]
        },
        {
          branchIndex: 1,
          createdAt: '2026-06-24T12:30:00Z',
          totalAmount: 250000.00,
          discountAmount: 50000.00,
          finalAmount: 200000.00,
          pointsEarned: 20,
          items: [
            { menuItemName: 'latte', quantity: 2, unitPrice: 100000.00 },
            { menuItemName: 'croissant', quantity: 1, unitPrice: 50000.00 }
          ]
        }
      ],
      extraTransactions: [
        {
          type: 'redeem',
          points: -100,
          note: 'Đổi 100 điểm lấy Voucher giảm giá 50.000đ',
          createdAt: '2026-06-22T09:15:00Z'
        },
        {
          type: 'expired',
          points: -15,
          note: 'Điểm thưởng hết hạn sử dụng (Quá 365 ngày)',
          createdAt: '2026-05-01T00:00:00Z'
        }
      ]
    },
    {
      phone: '0987654322',
      fullName: 'Trần Thị B',
      email: 'tranthib@gmail.com',
      birthday: '1997-04-20',
      tier: 'silver',
      points: 80,
      spent: 1800000.00,
      source: 'online-register',
      joinedAt: '2025-11-20T10:00:00Z',
      orders: [
        {
          branchIndex: 0,
          createdAt: '2026-06-15T08:15:00Z',
          totalAmount: 80000.00,
          discountAmount: 0.00,
          finalAmount: 80000.00,
          pointsEarned: 8,
          items: [{ menuItemName: 'espresso', quantity: 2, unitPrice: 40000.00 }]
        }
      ],
      extraTransactions: [
        {
          type: 'earn',
          points: 10,
          note: 'Tặng điểm kích hoạt tài khoản mới',
          createdAt: '2025-11-20T10:05:00Z'
        }
      ]
    },
    {
      phone: '0987654323',
      fullName: 'Lê Văn C',
      email: 'levanc@gmail.com',
      birthday: '1990-12-05',
      tier: 'platinum',
      points: 450,
      spent: 12500000.00,
      source: 'mobile-app',
      joinedAt: '2025-08-01T09:00:00Z',
      orders: [
        {
          branchIndex: 1,
          createdAt: '2026-06-22T20:00:00Z',
          totalAmount: 450000.00,
          discountAmount: 45000.00,
          finalAmount: 405000.00,
          pointsEarned: 40,
          items: [
            { menuItemName: 'espresso', quantity: 5, unitPrice: 50000.00 },
            { menuItemName: 'croissant', quantity: 4, unitPrice: 50000.00 }
          ]
        }
      ],
      extraTransactions: [
        {
          type: 'redeem',
          points: -200,
          note: 'Đổi Voucher buffet chiều hoàng hôn',
          createdAt: '2026-06-10T15:00:00Z'
        }
      ]
    },
    {
      phone: '0987654324',
      fullName: 'Phạm Thị D',
      email: 'phamthid@gmail.com',
      birthday: '2000-09-10',
      tier: 'bronze',
      points: 15,
      spent: 350000.00,
      source: 'walk-in',
      joinedAt: '2026-02-14T14:00:00Z',
      orders: [
        {
          branchIndex: 0,
          createdAt: '2026-05-20T10:30:00Z',
          totalAmount: 150000.00,
          discountAmount: 0.00,
          finalAmount: 150000.00,
          pointsEarned: 15,
          items: [{ menuItemName: 'tea', quantity: 3, unitPrice: 50000.00 }]
        }
      ],
      extraTransactions: []
    },
    {
      phone: '0987654325',
      fullName: 'Hoàng Văn E',
      email: 'hoangvane@gmail.com',
      birthday: '1988-06-30',
      tier: 'gold',
      points: 180,
      spent: 4200000.00,
      source: 'online-register',
      joinedAt: '2025-12-05T16:00:00Z',
      orders: [
        {
          branchIndex: 0,
          createdAt: '2026-06-18T14:20:00Z',
          totalAmount: 120000.00,
          discountAmount: 12000.00,
          finalAmount: 108000.00,
          pointsEarned: 10,
          items: [{ menuItemName: 'latte', quantity: 2, unitPrice: 60000.00 }]
        }
      ],
      extraTransactions: []
    },
    {
      phone: '0987654326',
      fullName: 'Vũ Thị F',
      email: 'vuthif@gmail.com',
      birthday: '1993-01-25',
      tier: 'silver',
      points: 95,
      spent: 2100000.00,
      source: 'mobile-app',
      joinedAt: '2026-01-10T11:00:00Z',
      orders: [
        {
          branchIndex: 1,
          createdAt: '2026-06-11T12:00:00Z',
          totalAmount: 220000.00,
          discountAmount: 20000.00,
          finalAmount: 200000.00,
          pointsEarned: 20,
          items: [
            { menuItemName: 'latte', quantity: 2, unitPrice: 60000.00 },
            { menuItemName: 'croissant', quantity: 2, unitPrice: 50000.00 }
          ]
        }
      ],
      extraTransactions: []
    },
    {
      phone: '0987654327',
      fullName: 'Ngô Văn G',
      email: 'ngovang@gmail.com',
      birthday: '1996-11-12',
      tier: 'platinum',
      points: 520,
      spent: 15000000.00,
      source: 'walk-in',
      joinedAt: '2025-07-20T08:00:00Z',
      orders: [
        {
          branchIndex: 0,
          createdAt: '2026-06-23T18:30:00Z',
          totalAmount: 350000.00,
          discountAmount: 35000.00,
          finalAmount: 315000.00,
          pointsEarned: 35,
          items: [{ menuItemName: 'latte', quantity: 5, unitPrice: 70000.00 }]
        }
      ],
      extraTransactions: []
    },
    {
      phone: '0987654328',
      fullName: 'Đỗ Thị H',
      email: 'dothih@gmail.com',
      birthday: '1999-07-18',
      tier: 'bronze',
      points: 0,
      spent: 0.00,
      source: 'online-register',
      joinedAt: '2026-05-15T15:30:00Z',
      orders: [],
      extraTransactions: []
    }
  ];

  var createdCustomers = [];

  for (var i = 0; i < customersData.length; i++) {
    var cData = customersData[i];
    
    // Clean up existing data for this customer to make it idempotent
    var existingCustomer = await tx.customer.findUnique({
      where: { phone: cData.phone }
    });
    if (existingCustomer) {
      var memberships = await tx.customerMembership.findMany({
        where: { customerId: existingCustomer.id }
      });
      var membershipIds = memberships.map(function(m) { return m.id; });
      
      await tx.pointTransaction.deleteMany({
        where: { customerMembershipId: { in: membershipIds } }
      });
      
      var customerOrders = await tx.order.findMany({
        where: { customerId: existingCustomer.id },
        select: { id: true }
      });
      var orderIds = customerOrders.map(function(o) { return o.id; });
      if (orderIds.length > 0) {
        var invoices = await tx.invoice.findMany({
          where: { orderId: { in: orderIds } },
          select: { id: true }
        });
        var invoiceIds = invoices.map(function(inv) { return inv.id; });
        if (invoiceIds.length > 0) {
          await tx.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
        }
        await tx.deliveryOrder.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.invoice.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.order.deleteMany({ where: { id: { in: orderIds } } });
      }
      
      await tx.customerMembership.deleteMany({
        where: { customerId: existingCustomer.id }
      });
      
      await tx.customer.delete({
        where: { id: existingCustomer.id }
      });
    }

    // Create Customer
    var birthdayDate = cData.birthday ? new Date(Date.UTC(
      parseInt(cData.birthday.split('-')[0]),
      parseInt(cData.birthday.split('-')[1]) - 1,
      parseInt(cData.birthday.split('-')[2])
    )) : null;

    var customer = await tx.customer.create({
      data: {
        phone: cData.phone,
        fullName: cData.fullName,
        email: cData.email,
        birthday: birthdayDate,
        source: cData.source,
        avatarUrl: null
      }
    });

    // Create Membership
    var joinedAtDate = new Date(cData.joinedAt);
    var membership = await tx.customerMembership.create({
      data: {
        customerId: customer.id,
        tierId: seededTiers[cData.tier.toLowerCase()].id,
        totalPoints: cData.points,
        totalSpent: cData.spent,
        joinedAt: joinedAtDate,
        updatedAt: joinedAtDate
      }
    });

    // Create Orders
    if (cData.orders && cData.orders.length > 0) {
      for (var o = 0; o < cData.orders.length; o++) {
        var oData = cData.orders[o];
        var orderItems = oData.items.map(function(item) {
          return {
            menuItemId: menuItemsList[item.menuItemName].id,
            quantity: item.quantity,
            unitPrice: item.unitPrice
          };
        });

        var branchObj = branches.active[oData.branchIndex % branches.active.length];

        var order = await createSeededOrder(tx, {
          branchId: branchObj.id,
          customerId: customer.id,
          employeeId: employees.owner.id,
          status: 'paid',
          createdAt: new Date(oData.createdAt),
          totalAmount: oData.totalAmount,
          discountAmount: oData.discountAmount,
          finalAmount: oData.finalAmount,
          items: orderItems
        });

        if (oData.pointsEarned > 0) {
          await tx.pointTransaction.create({
            data: {
              customerMembershipId: membership.id,
              orderId: order.id,
              type: 'earn',
              points: oData.pointsEarned,
              note: 'Tích điểm từ đơn hàng ORD-' + new Date(order.createdAt).toISOString().slice(2, 10).replace(/-/g, '') + '-' + order.id.slice(-3).toUpperCase(),
              createdAt: new Date(oData.createdAt)
            }
          });
        }
      }
    }

    // Seed Point Transactions
    if (cData.extraTransactions && cData.extraTransactions.length > 0) {
      for (var t = 0; t < cData.extraTransactions.length; t++) {
        var pt = cData.extraTransactions[t];
        await tx.pointTransaction.create({
          data: {
            customerMembershipId: membership.id,
            type: pt.type,
            points: pt.points,
            note: pt.note,
            createdAt: new Date(pt.createdAt)
          }
        });
      }
    }

    createdCustomers.push({
      id: customer.id,
      phone: customer.phone,
      fullName: customer.fullName
    });
  }

  return createdCustomers;
}

async function seedDeliveryOrders(tx, branches, employees) {
  await tx.deliveryOrder.deleteMany({});

  var branchObj = branches.active[0];
  var employeeObj = employees.owner;
  var shippers = employees.shippers || [];

  var espresso = await tx.menuItem.findFirst({ where: { name: { contains: 'Espresso', mode: 'insensitive' } } });
  var latte = await tx.menuItem.findFirst({ where: { name: { contains: 'Latte', mode: 'insensitive' } } });
  var croissant = await tx.menuItem.findFirst({ where: { name: { contains: 'Croissant', mode: 'insensitive' } } });

  // 1. Pending Order
  var order1 = await createSeededOrder(tx, {
    branchId: branchObj.id,
    customerId: null,
    employeeId: employeeObj.id,
    orderType: 'delivery',
    status: 'pending',
    createdAt: new Date(Date.now() - 30 * 60000),
    totalAmount: 90000.00,
    discountAmount: 0.00,
    finalAmount: 105000.00,
    items: [
      { menuItemId: latte.id, quantity: 1, unitPrice: 49000.00 },
      { menuItemId: espresso.id, quantity: 1, unitPrice: 41000.00 }
    ]
  });
  await tx.deliveryOrder.create({
    data: {
      orderId: order1.id,
      customerName: 'Nguyễn Thị Bích',
      customerPhone: '0977112233',
      deliveryAddress: '234 Hoàng Hoa Thám, Ba Đình, Hà Nội',
      deliveryFee: 15000,
      status: 'pending',
      estimatedTime: new Date(Date.now() + 45 * 60000),
      note: 'Giao nước ít đá ngọt vừa'
    }
  });

  // 2. Assigned Order
  var order2 = await createSeededOrder(tx, {
    branchId: branchObj.id,
    customerId: null,
    employeeId: employeeObj.id,
    orderType: 'delivery',
    status: 'pending',
    createdAt: new Date(Date.now() - 45 * 60000),
    totalAmount: 49000.00,
    discountAmount: 0.00,
    finalAmount: 69000.00,
    items: [
      { menuItemId: latte.id, quantity: 1, unitPrice: 49000.00 }
    ]
  });
  await tx.deliveryOrder.create({
    data: {
      orderId: order2.id,
      customerName: 'Lê Hoàng Long',
      customerPhone: '0912345678',
      deliveryAddress: 'Phòng 402, Chung cư Mini ngõ 105 Doãn Kế Thiện, Cầu Giấy',
      deliveryFee: 20000,
      status: 'assigned',
      deliveryEmployeeId: shippers[0] ? shippers[0].id : null,
      estimatedTime: new Date(Date.now() + 30 * 60000),
      note: 'Khi đến bấm chuông cửa'
    }
  });

  // 3. On The Way Order
  var order3 = await createSeededOrder(tx, {
    branchId: branchObj.id,
    customerId: null,
    employeeId: employeeObj.id,
    orderType: 'delivery',
    status: 'pending',
    createdAt: new Date(Date.now() - 60 * 60000),
    totalAmount: 139000.00,
    discountAmount: 10000.00,
    finalAmount: 144000.00,
    items: [
      { menuItemId: croissant.id, quantity: 2, unitPrice: 45000.00 },
      { menuItemId: espresso.id, quantity: 1, unitPrice: 49000.00 }
    ]
  });
  await tx.deliveryOrder.create({
    data: {
      orderId: order3.id,
      customerName: 'Phạm Minh Đức',
      customerPhone: '0905999888',
      deliveryAddress: 'Tòa nhà Landmark 72, Phạm Hùng, Nam Từ Liêm',
      deliveryFee: 15000,
      status: 'on_the_way',
      deliveryEmployeeId: shippers[1] ? shippers[1].id : null,
      estimatedTime: new Date(Date.now() + 15 * 60000),
      note: 'Gửi ở bàn lễ tân tòa nhà'
    }
  });

  // 4. Completed Order
  var order4 = await createSeededOrder(tx, {
    branchId: branchObj.id,
    customerId: null,
    employeeId: employeeObj.id,
    orderType: 'delivery',
    status: 'completed',
    createdAt: new Date(Date.now() - 120 * 60000),
    totalAmount: 82000.00,
    discountAmount: 0.00,
    finalAmount: 97000.00,
    items: [
      { menuItemId: espresso.id, quantity: 2, unitPrice: 41000.00 }
    ]
  });
  await tx.deliveryOrder.create({
    data: {
      orderId: order4.id,
      customerName: 'Vũ Thu Trang',
      customerPhone: '0988223344',
      deliveryAddress: 'Số 15 ngách 2/8 Tây Hồ, Hà Nội',
      deliveryFee: 15000,
      status: 'delivered',
      deliveryEmployeeId: shippers[0] ? shippers[0].id : null,
      estimatedTime: new Date(Date.now() - 90 * 60000),
      deliveredAt: new Date(Date.now() - 95 * 60000),
      note: 'Khách yêu cầu mang túi giấy'
    }
  });

  // 5. Failed Order
  var order5 = await createSeededOrder(tx, {
    branchId: branchObj.id,
    customerId: null,
    employeeId: employeeObj.id,
    orderType: 'delivery',
    status: 'completed',
    createdAt: new Date(Date.now() - 180 * 60000),
    totalAmount: 49000.00,
    discountAmount: 0.00,
    finalAmount: 64000.00,
    items: [
      { menuItemId: latte.id, quantity: 1, unitPrice: 49000.00 }
    ]
  });
  await tx.deliveryOrder.create({
    data: {
      orderId: order5.id,
      customerName: 'Đặng Quốc Huy',
      customerPhone: '0933445566',
      deliveryAddress: '55 Nguyễn Chí Thanh, Đống Đa, Hà Nội',
      deliveryFee: 15000,
      status: 'failed',
      deliveryEmployeeId: shippers[2] ? shippers[2].id : null,
      estimatedTime: new Date(Date.now() - 150 * 60000),
      note: 'Gọi điện thoại 5 lần thuê bao không liên lạc được'
    }
  });
}

main();
