var prisma = require('../lib/prisma');
var authMiddleware = require('../middlewares/auth.middleware');

async function createStocktakeNote(payload, currentUser) {
  var branchId = payload.branchId;
  var items = payload.items; // Array of { ingredientId, systemQuantity, actualQuantity, variance, reason, note }
  var note = payload.note;

  if (!branchId) throwHttpError(400, 'Mã chi nhánh (branchId) là bắt buộc');
  if (!items || !Array.isArray(items) || items.length === 0) {
    throwHttpError(400, 'Danh sách nguyên liệu kiểm kho không hợp lệ hoặc trống');
  }

  // Verify branch jurisdiction
  if (!authMiddleware.isOwner(currentUser)) {
    if (currentUser.branchId !== branchId) {
      throwHttpError(403, 'Bạn không có quyền quản lý tồn kho cho chi nhánh này');
    }
  }

  // Create Stocktake Note and Items in a transaction
  var result = await prisma.$transaction(async (tx) => {
    // Validate items
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!item.ingredientId || typeof item.systemQuantity !== 'number' || typeof item.actualQuantity !== 'number') {
        throwHttpError(400, 'Dữ liệu kiểm kho không hợp lệ: Thiếu ingredientId, systemQuantity hoặc actualQuantity');
      }

      var ingredient = await tx.ingredient.findUnique({
        where: { id: item.ingredientId }
      });

      if (!ingredient) {
        throwHttpError(404, 'Không tìm thấy nguyên liệu: ' + item.ingredientId);
      }

      if (ingredient.branchId !== branchId) {
        throwHttpError(400, 'Nguyên liệu không thuộc chi nhánh này: ' + item.ingredientId);
      }
      
      if (item.actualQuantity < 0) {
        throwHttpError(400, 'Số lượng thực tế không được âm tại vị trí: ' + i);
      }
    }

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
  if (!branchId) throwHttpError(400, 'Mã chi nhánh (branchId) là bắt buộc');
  
  if (!authMiddleware.isOwner(currentUser) && currentUser.branchId !== branchId) {
    throwHttpError(403, 'Bạn không có quyền xem phiếu kiểm kho của chi nhánh này');
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
  if (!noteId) throwHttpError(400, 'Mã phiếu kiểm kho (noteId) là bắt buộc');
  if (action !== 'APPROVE' && action !== 'REJECT') {
    throwHttpError(400, 'Hành động (action) phải là APPROVE hoặc REJECT');
  }

  var note = await prisma.stocktakeNote.findUnique({
    where: { id: noteId },
    include: { items: true }
  });

  if (!note) throwHttpError(404, 'Không tìm thấy phiếu kiểm kho');

  if (note.status !== 'PENDING') {
    throwHttpError(400, 'Phiếu kiểm kho đã được xử lý (trạng thái: ' + note.status + ')');
  }

  // Verify jurisdiction and role
  var isOwner = authMiddleware.isOwner(currentUser);
  var isChainAdmin = authMiddleware.isChainAdmin(currentUser);

  if (!isOwner) {
    if (!isChainAdmin) {
      throwHttpError(403, 'Chỉ Chủ cửa hàng (Owner) hoặc Quản lý chuỗi (Chain Admin) mới có quyền duyệt phiếu kiểm kho');
    }
    if (currentUser.branchId !== note.branchId) {
      throwHttpError(403, 'Bạn không có quyền thao tác trên chi nhánh này');
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
