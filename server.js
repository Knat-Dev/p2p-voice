const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);
const socket = require('socket.io');
const io = socket(server, {
  cors: {
    origin: '*',
  },
});

const users = {};

io.on('connection', (socket) => {
  if (!users[socket.id]) {
    users[socket.id] = socket.id;
  }
  socket.emit('yourID', socket.id);
  io.sockets.emit('allUsers', users);
  socket.on('disconnect', () => {
    delete users[socket.id];
    io.sockets.emit('allUsers', users);
  });

  socket.on('callUser', (data) => {
    console.log('user called');
    io.to(data.userToCall).emit('hey', {
      signal: data.signalData,
      from: data.from,
    });
  });

  socket.on('acceptCall', (data) => {
    io.to(data.to).emit('callAccepted', data.signal);
  });

  socket.on('rejectCall', (data) => {
    io.to(data.to).emit('rejectCall', data.from);
  });

  socket.on('onicecandidate', (data) => {
    console.log('ice');
    io.to(data.to).emit('onicecandidate', data.candidate);
  });
});
server.listen(8000, () => console.log('server is running on port 8000'));
