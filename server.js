const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let waitingQueue = [];

io.on('connection', (socket) => {
  socket.on('start_match', () => {
    if (!waitingQueue.includes(socket.id)) {
      waitingQueue.push(socket.id);
      socket.emit('status', '配對中...');
    }

    if (waitingQueue.length >= 2) {
      const p1 = waitingQueue.shift();
      const p2 = waitingQueue.shift();
      const roomId = 'room_' + Date.now();

      io.sockets.sockets.get(p1)?.join(roomId);
      io.sockets.sockets.get(p2)?.join(roomId);

      io.to(roomId).emit('matched', { roomId });
    }
  });

  socket.on('disconnect', () => {
    waitingQueue = waitingQueue.filter(id => id !== socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
