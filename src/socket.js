// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\socket.js
const socketIO = require('socket.io');

let io;

exports.initializeSocket = (server, corsOptions) => {
  io = socketIO(server, {
    cors: corsOptions
  });

  io.on('connection', (socket) => {
    console.log('✅ New client connected:', socket.id);
    
    // Join user-specific room — frontend sends { userId } object
    socket.on('join-user', (data) => {
      const userId = data?.userId || data;
      socket.join(`user-${userId}`);
      console.log(`User ${userId} joined room`);
    });
    
    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
    });
  });

  return io;
};

exports.getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};