const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let waitingQueue = [];
let rooms = {};

io.on('connection', (socket) => {
  console.log('玩家連線成功:', socket.id);

  // 玩家請求配對
  socket.on('start_match', () => {
    // 【防重複 1】：檢查自己是否已經在排隊清單中
    const isAlreadyWaiting = waitingQueue.some(s => s.id === socket.id);
    if (isAlreadyWaiting) {
      console.log('重複點擊，已忽略:', socket.id);
      return;
    }

    waitingQueue.push(socket);
    socket.emit('status', '配對中，搜尋線上玩家...');
    console.log(`目前排隊人數: ${waitingQueue.length}`);

    // 只保留當前仍連線中的玩家
    waitingQueue = waitingQueue.filter(s => s.connected);

    // 檢查是否有 2 位不同的玩家
    if (waitingQueue.length >= 2) {
      const player1 = waitingQueue.shift();
      const player2 = waitingQueue.shift();

      // 【防重複 2】：如果是同一個 ID，強制退回一個，不准開局
      if (player1.id === player2.id) {
        waitingQueue.unshift(player1);
        return;
      }

      const roomId = 'room_' + Date.now();
      player1.join(roomId);
      player2.join(roomId);

      rooms[roomId] = {
        players: {
          [player1.id]: { name: '玩家 1', cards: [Math.floor(Math.random() * 10) + 1] },
          [player2.id]: { name: '玩家 2', cards: [Math.floor(Math.random() * 10) + 1] }
        }
      };

      console.log(`配對成功，房間: ${roomId}，玩家: ${player1.id} 與 ${player2.id}`);

      // 雙方同時發送進房訊號
      io.in(roomId).emit('game_start', {
        roomId: roomId,
        players: rooms[roomId].players
      });
    }
  });

  // 抽牌動作
  socket.on('draw_card', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.players[socket.id]) return;

    room.players[socket.id].cards.push(Math.floor(Math.random() * 10) + 1);
    io.in(roomId).emit('update_board', { players: room.players });
  });

  // 離線處理
  socket.on('disconnect', () => {
    waitingQueue = waitingQueue.filter(s => s.id !== socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
