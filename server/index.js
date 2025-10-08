const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const roomManager = require('./roomManager');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Homepage - create new room and redirect
app.get('/', (req, res) => {
  const roomId = roomManager.createRoom();
  res.redirect(`/${roomId}`);
});

// Room page
app.get('/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/room.html'));
});

// TURN server configuration endpoint
app.get('/api/turn-credentials', (req, res) => {
  const username = process.env.TURN_USERNAME || '8cdc3d1039188da71fc4741a';
  const credential = process.env.TURN_PASSWORD || '4WPTPa4UhibcafoR';

  res.json({
    iceServers: [
      {
        urls: "stun:stun.relay.metered.ca:80"
      },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: username,
        credential: credential
      },
      {
        urls: "turn:global.relay.metered.ca:80?transport=tcp",
        username: username,
        credential: credential
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: username,
        credential: credential
      },
      {
        urls: "turns:global.relay.metered.ca:443?transport=tcp",
        username: username,
        credential: credential
      }
    ]
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  let currentRoomId = null;
  let currentUsername = null;

  // Join room
  socket.on('join-room', ({ roomId, username, peerId }) => {
    try {
      // Sanitize username
      const sanitizedUsername = roomManager.sanitizeUsername(username);

      // Get or create room (first person becomes creator)
      const room = roomManager.getOrCreateRoom(roomId, socket.id);

      // Add participant to room
      room.addParticipant(socket.id, sanitizedUsername, peerId);

      // Join socket.io room
      socket.join(roomId);

      // Store current room and username
      currentRoomId = roomId;
      currentUsername = sanitizedUsername;

      // Get list of other participants (excluding the one joining)
      const otherParticipants = room.getParticipantsList()
        .filter(p => p.socketId !== socket.id);

      // Send confirmation to the joining user
      socket.emit('room-joined', {
        participants: otherParticipants,
        isCreator: room.isCreator(socket.id)
      });

      // Notify others in the room about the new user
      socket.to(roomId).emit('user-joined', {
        socketId: socket.id,
        username: sanitizedUsername,
        peerId: peerId
      });

      console.log(`${sanitizedUsername} joined room ${roomId}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // WebRTC signaling - offer
  socket.on('webrtc-offer', ({ to, offer }) => {
    socket.to(to).emit('webrtc-offer', {
      from: socket.id,
      offer: offer
    });
  });

  // WebRTC signaling - answer
  socket.on('webrtc-answer', ({ to, answer }) => {
    socket.to(to).emit('webrtc-answer', {
      from: socket.id,
      answer: answer
    });
  });

  // WebRTC signaling - ICE candidate
  socket.on('ice-candidate', ({ to, candidate }) => {
    socket.to(to).emit('ice-candidate', {
      from: socket.id,
      candidate: candidate
    });
  });

  // Text message
  socket.on('send-message', ({ message }) => {
    if (!currentRoomId) return;

    const sanitizedMessage = roomManager.sanitizeMessage(message);
    if (!sanitizedMessage) return;

    // Broadcast message to everyone in the room (including sender)
    io.to(currentRoomId).emit('receive-message', {
      username: currentUsername,
      message: sanitizedMessage,
      timestamp: Date.now(),
      socketId: socket.id
    });
  });

  // Toggle mute status
  socket.on('toggle-mute', ({ isMuted }) => {
    if (!currentRoomId) return;

    const room = roomManager.getRoom(currentRoomId);
    if (!room) return;

    const participant = room.getParticipant(socket.id);
    if (participant) {
      participant.isMuted = isMuted;

      // Notify others about mute status change
      socket.to(currentRoomId).emit('user-muted', {
        socketId: socket.id,
        isMuted: isMuted
      });
    }
  });

  // Kick user (only creator can kick)
  socket.on('kick-user', ({ targetSocketId }) => {
    if (!currentRoomId) return;

    const room = roomManager.getRoom(currentRoomId);
    if (!room) return;

    // Check if the requester is the creator
    if (!room.isCreator(socket.id)) {
      socket.emit('error', { message: 'Only the room creator can kick users' });
      return;
    }

    // Can't kick yourself
    if (targetSocketId === socket.id) {
      socket.emit('error', { message: 'Cannot kick yourself' });
      return;
    }

    // Remove participant from room
    room.removeParticipant(targetSocketId);

    // Notify the kicked user
    io.to(targetSocketId).emit('you-were-kicked');

    // Notify everyone else
    socket.to(currentRoomId).emit('user-kicked', {
      socketId: targetSocketId
    });

    // Force disconnect the kicked user from the room
    const kickedSocket = io.sockets.sockets.get(targetSocketId);
    if (kickedSocket) {
      kickedSocket.leave(currentRoomId);
    }

    console.log(`User ${targetSocketId} was kicked from room ${currentRoomId}`);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    if (currentRoomId) {
      const room = roomManager.getRoom(currentRoomId);
      if (room) {
        // Remove participant
        room.removeParticipant(socket.id);

        // Notify others
        socket.to(currentRoomId).emit('user-left', {
          socketId: socket.id
        });

        // Clean up empty rooms
        if (room.isEmpty()) {
          roomManager.removeRoom(currentRoomId);
          console.log(`Room ${currentRoomId} removed (empty)`);
        }
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to create a room`);
});
