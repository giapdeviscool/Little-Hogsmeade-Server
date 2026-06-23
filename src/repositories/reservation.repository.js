var prisma = require('../lib/prisma');

function findWithTableById(id) {
  return prisma.reservation.findUnique({
    where: { id: id },
    include: {
      table: {
        select: {
          id: true,
          name: true,
          capacity: true,
          reservationId: true,
          area: { select: { branchId: true } }
        }
      }
    }
  });
}

module.exports = {
  findWithTableById: findWithTableById
};
