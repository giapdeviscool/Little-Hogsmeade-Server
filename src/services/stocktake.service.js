var prisma = require('../lib/prisma');
var authMiddleware = require('../middlewares/auth.middleware');

async function createStocktakeNote(payload, currentUser) {
  var branchId = payload.branchId;
  var items = payload.items; // Array of { ingredientId, systemQuantity, actualQuantity, variance, reason, note }
  var note = payload.note;

  if (!branchId) {
    throwHttpError(400, 'branchId is required');
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throwHttpError(400, 'items array is required and cannot be empty');
  }

  // Verify branch jurisdiction
  if (!authMiddleware.isOwner(currentUser)) {
    if (currentUser.branchId !== branchId) {
      throwHttpError(403, 'You do not have permission to manage stocktake for this branch');
    }
  }

  // Validate items
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (!item.ingredientId || item.systemQuantity === undefined || item.actualQuantity === undefined) {
      throwHttpError(400, 'Invalid item data at index ' + i);
    }
    if (item.actualQuantity < 0) {
      throwHttpError(400, 'Actual quantity cannot be negative for item index ' + i);
    }
  }

  // Create Stocktake Note and Items in a transaction
  var result = await prisma.$transaction(async (tx) => {
    var stocktakeNote = await tx.stocktakeNote.create({
      data: {
        branchId: branchId,
        employeeId: currentUser.id,
        status: 'PENDING',
        note: note || '',
        items: {
          create: items.map(item => ({
            ingredientId: item.ingredientId,
            systemQuantity: item.systemQuantity,
            actualQuantity: item.actualQuantity,
            variance: item.variance !== undefined ? item.variance : (item.actualQuantity - item.systemQuantity),
            reason: item.reason || '',
            note: item.note || ''
          }))
        }
      },
      include: {
        items: true
      }
    });

    return stocktakeNote;
  });

  return result;
}

async function getPendingStocktakes(branchId, currentUser) {
  if (!branchId) throwHttpError(400, 'branchId is required');
  
  if (!authMiddleware.isOwner(currentUser) && currentUser.branchId !== branchId) {
    throwHttpError(403, 'You do not have permission to view stocktakes for this branch');
  }

  var notes = await prisma.stocktakeNote.findMany({
    where: {
      branchId: branchId,
      status: 'PENDING'
    },
    include: {
      employee: {
        select: { id: true, fullName: true, email: true }
      },
      items: {
        include: {
          ingredient: {
            select: { id: true, name: true, sku: true, unit: true, currentStock: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return notes;
}

async function processStocktake(noteId, action, currentUser) {
  if (!noteId) throwHttpError(400, 'noteId is required');
  if (action !== 'APPROVE' && action !== 'REJECT') {
    throwHttpError(400, 'action must be APPROVE or REJECT');
  }

  var note = await prisma.stocktakeNote.findUnique({
    where: { id: noteId },
    include: { items: true }
  });

  if (!note) throwHttpError(404, 'Stocktake note not found');

  if (note.status !== 'PENDING') {
    throwHttpError(400, 'Stocktake note is already ' + note.status);
  }

  // Verify jurisdiction and role
  if (!authMiddleware.isOwner(currentUser)) {
    // Only Chain Admin / Owner can process (BR-INV20)
    var roleName = currentUser.roleName || (currentUser.role && currentUser.role.name) || '';
    var isChainAdmin = roleName === 'Chain Admin' || roleName === 'Admin' || roleName === 'Manager';
    if (!isChainAdmin) {
      throwHttpError(403, 'Only Owner or Chain Admin can process stocktake notes');
    }
    if (currentUser.branchId !== note.branchId) {
      throwHttpError(403, 'You do not have permission for this branch');
    }
  }

  return await prisma.$transaction(async (tx) => {
    if (action === 'REJECT') {
      return await tx.stocktakeNote.update({
        where: { id: noteId },
        data: { status: 'REJECTED' }
      });
    }

    // APPROVE action
    for (var i = 0; i < note.items.length; i++) {
      var item = note.items[i];
      var variance = item.variance;

      if (variance === 0) continue; // No change needed

      // Update current stock
      await tx.ingredient.update({
        where: { id: item.ingredientId },
        data: {
          currentStock: {
            increment: variance // can be negative, which decrements
          }
        }
      });

      // Compensatory logging
      var transactionType = variance > 0 ? 'STOCKTAKE_SURPLUS' : 'STOCKTAKE_SHORTAGE';
      var quantityAbs = Math.abs(variance);

      await tx.stockTransaction.create({
        data: {
          branchId: note.branchId,
          ingredientId: item.ingredientId,
          type: transactionType,
          quantity: quantityAbs,
          unitCost: 0,
          totalCost: 0,
          employeeId: currentUser.id,
          referenceId: null, // Note doesn't have integer ID, maybe add note string
          note: `Stocktake Note: ${noteId}. Reason: ${item.reason || 'N/A'}`
        }
      });
    }

    return await tx.stocktakeNote.update({
      where: { id: noteId },
      data: { status: 'PROCESSED' }
    });
  });
}

function throwHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

module.exports = {
  createStocktakeNote: createStocktakeNote,
  getPendingStocktakes: getPendingStocktakes,
  processStocktake: processStocktake
};
