var { PrismaClient } = require('@prisma/client');
var prisma = new PrismaClient();

async function main() {
  console.log('Clearing old delivery orders...');
  
  // 1. Find all current delivery orders
  var deliveryOrders = await prisma.deliveryOrder.findMany({});
  var orderIds = deliveryOrders.map(function(d) { return d.orderId; }).filter(Boolean);
  
  // 2. Delete delivery orders
  await prisma.deliveryOrder.deleteMany({});
  
  if (orderIds.length > 0) {
    // 3. Find invoices for those orders
    var invoices = await prisma.invoice.findMany({ where: { orderId: { in: orderIds } } });
    var invoiceIds = invoices.map(function(i) { return i.id; });
    
    // 4. Delete payments for those invoices
    await prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    
    // 5. Delete invoices
    await prisma.invoice.deleteMany({ where: { orderId: { in: orderIds } } });
    
    // 6. Delete order items
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    
    // 7. Delete orders
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  }

  console.log('Fetching branch, owner, and shippers...');
  var branchObj = await prisma.branch.findFirst({ where: { status: 'active' } });
  if (!branchObj) {
    branchObj = await prisma.branch.findFirst({});
  }

  var owner = await prisma.employee.findFirst({
    where: {
      role: {
        name: { in: ['owner', 'chain owner', 'admin', 'manager'] }
      }
    }
  });
  if (!owner) {
    owner = await prisma.employee.findFirst({});
  }

  var shippers = await prisma.employee.findMany({
    where: {
      role: {
        name: { contains: 'shipper', mode: 'insensitive' }
      }
    }
  });

  if (shippers.length === 0) {
    shippers = await prisma.employee.findMany({
      where: {
        role: {
          name: { contains: 'giao', mode: 'insensitive' }
        }
      }
    });
  }

  var espresso = await prisma.menuItem.findFirst({ where: { name: { contains: 'Espresso', mode: 'insensitive' } } });
  var latte = await prisma.menuItem.findFirst({ where: { name: { contains: 'Latte', mode: 'insensitive' } } });
  var croissant = await prisma.menuItem.findFirst({ where: { name: { contains: 'Croissant', mode: 'insensitive' } } });

  if (!espresso || !latte || !croissant) {
    console.error('Menu items Espresso, Latte, or Croissant not found. Please seed base items first.');
    process.exit(1);
  }

  console.log('Seeding 5 delivery orders...');

  // Helper function to create order
  async function createSeededOrder(data) {
    var order = await prisma.order.create({
      data: {
        branchId: data.branchId,
        customerId: data.customerId,
        employeeId: data.employeeId,
        orderType: data.orderType || 'delivery',
        status: data.status,
        createdAt: data.createdAt,
        updatedAt: data.createdAt
      }
    });

    for (var i = 0; i < data.items.length; i++) {
      var item = data.items[i];
      await prisma.orderItem.create({
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

    var invoice = await prisma.invoice.create({
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

    await prisma.payment.create({
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

  // 1. Pending Order
  var order1 = await createSeededOrder({
    branchId: branchObj.id,
    customerId: null,
    employeeId: owner.id,
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
  await prisma.deliveryOrder.create({
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
  var order2 = await createSeededOrder({
    branchId: branchObj.id,
    customerId: null,
    employeeId: owner.id,
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
  await prisma.deliveryOrder.create({
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
  var order3 = await createSeededOrder({
    branchId: branchObj.id,
    customerId: null,
    employeeId: owner.id,
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
  await prisma.deliveryOrder.create({
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
  var order4 = await createSeededOrder({
    branchId: branchObj.id,
    customerId: null,
    employeeId: owner.id,
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
  await prisma.deliveryOrder.create({
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
  var order5 = await createSeededOrder({
    branchId: branchObj.id,
    customerId: null,
    employeeId: owner.id,
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
  await prisma.deliveryOrder.create({
    data: {
      orderId: order5.id,
      customerName: 'Trần Văn Hùng',
      customerPhone: '0944556677',
      deliveryAddress: 'Ngõ 20 Hồ Tùng Mậu, Cầu Giấy, Hà Nội',
      deliveryFee: 15000,
      status: 'failed',
      deliveryEmployeeId: shippers[1] ? shippers[1].id : null,
      estimatedTime: new Date(Date.now() - 150 * 60000),
      note: 'Khách hàng không nghe máy sau 3 lần gọi'
    }
  });

  console.log('Seeded delivery orders successfully.');
}

main()
  .catch(function(e) {
    console.error(e);
    process.exit(1);
  })
  .finally(async function() {
    await prisma.$disconnect();
  });
