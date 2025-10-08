// Socket.IO client wrapper
class SocketManager {
  constructor() {
    this.socket = null;
    this.roomId = null;
    this.username = null;
    this.peerId = null;
    this.isCreator = false;
    this.callbacks = {
      roomJoined: null,
      userJoined: null,
      userLeft: null,
      userKicked: null,
      youWereKicked: null,
      receiveMessage: null,
      userMuted: null,
      webrtcOffer: null,
      webrtcAnswer: null,
      iceCandidate: null,
      error: null
    };
  }

  connect() {
    this.socket = io();
    this.setupListeners();
  }

  setupListeners() {
    // Room joined successfully
    this.socket.on('room-joined', (data) => {
      this.isCreator = data.isCreator;
      if (this.callbacks.roomJoined) {
        this.callbacks.roomJoined(data);
      }
    });

    // New user joined
    this.socket.on('user-joined', (data) => {
      if (this.callbacks.userJoined) {
        this.callbacks.userJoined(data);
      }
    });

    // User left
    this.socket.on('user-left', (data) => {
      if (this.callbacks.userLeft) {
        this.callbacks.userLeft(data);
      }
    });

    // User kicked
    this.socket.on('user-kicked', (data) => {
      if (this.callbacks.userKicked) {
        this.callbacks.userKicked(data);
      }
    });

    // You were kicked
    this.socket.on('you-were-kicked', () => {
      if (this.callbacks.youWereKicked) {
        this.callbacks.youWereKicked();
      }
    });

    // Text message received
    this.socket.on('receive-message', (data) => {
      if (this.callbacks.receiveMessage) {
        this.callbacks.receiveMessage(data);
      }
    });

    // User muted/unmuted
    this.socket.on('user-muted', (data) => {
      if (this.callbacks.userMuted) {
        this.callbacks.userMuted(data);
      }
    });

    // WebRTC signaling - offer
    this.socket.on('webrtc-offer', (data) => {
      if (this.callbacks.webrtcOffer) {
        this.callbacks.webrtcOffer(data);
      }
    });

    // WebRTC signaling - answer
    this.socket.on('webrtc-answer', (data) => {
      if (this.callbacks.webrtcAnswer) {
        this.callbacks.webrtcAnswer(data);
      }
    });

    // WebRTC signaling - ICE candidate
    this.socket.on('ice-candidate', (data) => {
      if (this.callbacks.iceCandidate) {
        this.callbacks.iceCandidate(data);
      }
    });

    // Error
    this.socket.on('error', (data) => {
      console.error('Socket error:', data.message);
      if (this.callbacks.error) {
        this.callbacks.error(data);
      }
    });
  }

  joinRoom(roomId, username, peerId) {
    this.roomId = roomId;
    this.username = username;
    this.peerId = peerId;
    this.socket.emit('join-room', { roomId, username, peerId });
  }

  sendMessage(message) {
    this.socket.emit('send-message', { message });
  }

  toggleMute(isMuted) {
    this.socket.emit('toggle-mute', { isMuted });
  }

  kickUser(targetSocketId) {
    this.socket.emit('kick-user', { targetSocketId });
  }

  sendWebRTCOffer(to, offer) {
    this.socket.emit('webrtc-offer', { to, offer });
  }

  sendWebRTCAnswer(to, answer) {
    this.socket.emit('webrtc-answer', { to, answer });
  }

  sendICECandidate(to, candidate) {
    this.socket.emit('ice-candidate', { to, candidate });
  }

  on(event, callback) {
    if (this.callbacks.hasOwnProperty(event)) {
      this.callbacks[event] = callback;
    }
  }
}
