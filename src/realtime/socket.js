var io = null;

function initialize(server) {
  var SocketIOServer = require('socket.io').Server;

  io = new SocketIOServer(server, {
    cors: { origin: '*' }
  });

  global.io = io;

  return io;
}

function emitTableStatusUpdated(payload) {
  if (io) {
    io.emit('table_status_updated', payload);
  }
}

module.exports = {
  initialize: initialize,
  emitTableStatusUpdated: emitTableStatusUpdated
};
