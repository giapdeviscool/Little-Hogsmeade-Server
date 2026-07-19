var prisma = require('../lib/prisma');
var authMiddleware = require('../middlewares/auth.middleware');
var ingredientRepository = require('../repositories/ingredient.repository');

async function createGoodsReceipt(payload, currentUser) {
  var branchId = payload.branchId;
  var items = payload.items; // Array of { ingredientId, quantity, unitCost, note }

  if (!branchId) {
    throwHttpError(400, 'branchId is required');
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throwHttpError(400, 'items array is required and cannot be empty');
  }

  // Verify branch jurisdiction
  if (!authMiddleware.isOwner(currentUser)) {
    if (currentUser.branchId !== branchId) {
      throwHttpError(403, 'You do not have permission to manage inventory for this branch');
    }
  }

  // Use Prisma transaction to ensure atomicity
  var result = await prisma.$transaction(async (tx) => {
    var createdTransactions = [];

    for (var i = 0; i < items.length; i++) {
      var item = items[i];

      if (!item.ingredientId || !item.quantity || item.quantity <= 0) {
        throwHttpError(400, 'Invalid item data: ingredientId and positive quantity are required');
      }

      // Fetch the ingredient to get conversion rate
      var ingredient = await tx.ingredient.findUnique({
        where: { id: item.ingredientId }
      });

      if (!ingredient) {
        throwHttpError(404, 'Ingredient not found: ' + item.ingredientId);
      }

      if (ingredient.branchId !== branchId) {
        throwHttpError(400, 'Ingredient does not belong to the specified branch: ' + item.ingredientId);
      }

      // BR-INV13: Convert from import unit to export unit
      var conversionRate = ingredient.conversionRate || 1.0;
      var exportQuantity = item.quantity * conversionRate;
      var unitCost = item.unitCost || 0;
      var totalCost = exportQuantity * unitCost;

      // Update current stock
      var updatedIngredient = await tx.ingredient.update({
        where: { id: item.ingredientId },
        data: {
          currentStock: {
            increment: exportQuantity
          }
        }
      });

      // Note: We skip MAC calculation as decided, keeping totalCost and unitCost in the transaction record.
      
      // Create Stock Transaction record
      var stockTx = await tx.stockTransaction.create({
        data: {
          branchId: branchId,
          ingredientId: item.ingredientId,
          type: 'RECEIPT',
          quantity: exportQuantity,
          unitCost: unitCost,
          totalCost: totalCost,
          employeeId: currentUser.id,
          note: item.note || 'Goods Receipt'
        }
      });

      createdTransactions.push(stockTx);
    }

    return createdTransactions;
  });

  return result;
}

function throwHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

async function createGoodsIssue(payload, currentUser) {
  var branchId = payload.branchId;
  var items = payload.items; // Array of { ingredientId, quantity, reason, note }

  if (!branchId) {
    throwHttpError(400, 'branchId is required');
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throwHttpError(400, 'items array is required and cannot be empty');
  }

  // Verify branch jurisdiction
  if (!authMiddleware.isOwner(currentUser)) {
    if (currentUser.branchId !== branchId) {
      throwHttpError(403, 'You do not have permission to manage inventory for this branch');
    }
  }

  var validReasons = ['INTERNAL_USE', 'DISPOSAL', 'DAMAGED'];

  // Use Prisma transaction to ensure atomicity
  var result = await prisma.$transaction(async (tx) => {
    var createdTransactions = [];

    for (var i = 0; i < items.length; i++) {
      var item = items[i];

      if (!item.ingredientId || !item.quantity || item.quantity <= 0) {
        throwHttpError(400, 'Invalid item data: ingredientId and positive quantity are required');
      }

      var reasonUpper = (item.reason || '').toUpperCase();
      if (!validReasons.includes(reasonUpper)) {
        throwHttpError(400, 'Invalid reason code: ' + item.reason);
      }

      // Fetch the ingredient to check current stock
      var ingredient = await tx.ingredient.findUnique({
        where: { id: item.ingredientId }
      });

      if (!ingredient) {
        throwHttpError(404, 'Ingredient not found: ' + item.ingredientId);
      }

      if (ingredient.branchId !== branchId) {
        throwHttpError(400, 'Ingredient does not belong to the specified branch: ' + item.ingredientId);
      }

      // BR-INV19: Strict Hard Limit on Deductions
      if (ingredient.currentStock < item.quantity) {
        throwHttpError(400, `Số lượng tồn kho không đủ cho ${ingredient.name}. Hiện có: ${ingredient.currentStock}, Yêu cầu: ${item.quantity}`);
      }

      // Update current stock
      var updatedIngredient = await tx.ingredient.update({
        where: { id: item.ingredientId },
        data: {
          currentStock: {
            decrement: item.quantity
          }
        }
      });

      // Create Stock Transaction record
      var stockTx = await tx.stockTransaction.create({
        data: {
          branchId: branchId,
          ingredientId: item.ingredientId,
          type: 'ISSUE_' + reasonUpper,
          quantity: item.quantity,
          unitCost: 0,
          totalCost: 0,
          employeeId: currentUser.id,
          note: item.note || ''
        }
      });

      createdTransactions.push(stockTx);
    }

    return createdTransactions;
  });

  return result;
}

async function getStockLedger(branchId, ingredientId, startDate, endDate, currentUser) {
  if (!branchId || !ingredientId || !startDate || !endDate) {
    throwHttpError(400, 'branchId, ingredientId, startDate, and endDate are required');
  }

  // Verify branch jurisdiction (BR-INV29)
  var isOwner = authMiddleware.isOwner(currentUser);
  var isChainAdmin = authMiddleware.isChainAdmin(currentUser);
  
  if (!isOwner && !isChainAdmin) {
    throwHttpError(403, 'Only Owner or Chain Admin can view stock ledger');
  }
  if (!isOwner && currentUser.branchId !== branchId) {
    throwHttpError(403, 'You do not have permission for this branch');
  }

  var parsedStartDate = new Date(startDate);
  var parsedEndDate = new Date(endDate);

  var additionTypes = ['RECEIPT', 'STOCKTAKE_SURPLUS', 'MANUAL_ADD'];

  // 1. Calculate Starting Balance
  var pastTransactions = await prisma.stockTransaction.findMany({
    where: {
      branchId: branchId,
      ingredientId: ingredientId,
      createdAt: { lt: parsedStartDate }
    }
  });

  var startingBalance = 0;
  for (var i = 0; i < pastTransactions.length; i++) {
    var tx = pastTransactions[i];
    if (additionTypes.includes(tx.type)) {
      startingBalance += tx.quantity;
    } else {
      startingBalance -= tx.quantity;
    }
  }

  // 2. Fetch Transactions in range
  var transactions = await prisma.stockTransaction.findMany({
    where: {
      branchId: branchId,
      ingredientId: ingredientId,
      createdAt: {
        gte: parsedStartDate,
        lte: parsedEndDate
      }
    },
    include: {
      employee: {
        select: { 
          id: true, 
          fullName: true, 
          role: { select: { name: true } } 
        }
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  // 3. Compute Running Balance
  var runningBalance = startingBalance;
  var ledger = [];

  for (var i = 0; i < transactions.length; i++) {
    var tx = transactions[i];
    var isAddition = additionTypes.includes(tx.type);
    
    if (isAddition) {
      runningBalance += tx.quantity;
    } else {
      runningBalance -= tx.quantity;
    }

    ledger.push({
      ...tx,
      quantityChanged: isAddition ? tx.quantity : -tx.quantity,
      remainingBalance: runningBalance
    });
  }

  // Sort descending for UI (newest first)
  ledger.reverse();

  return {
    startingBalance: startingBalance,
    endingBalance: runningBalance,
    transactions: ledger
  };
}

module.exports = {
  createGoodsReceipt: createGoodsReceipt,
  createGoodsIssue: createGoodsIssue,
  getStockLedger: getStockLedger
};
