// Main application logic
class ConcordApp {
  constructor() {
    this.socketManager = new SocketManager();
    this.webrtcManager = new WebRTCManager(this.socketManager);
    this.roomId = null;
    this.username = null;
    this.participants = new Map(); // socketId -> {username, peerId, isMuted}
    this.setupEventListeners();
  }

  async initialize() {
    // Get room ID from URL
    const path = window.location.pathname;
    this.roomId = path.substring(1); // Remove leading slash

    if (!this.roomId) {
      window.location.href = '/';
      return;
    }

    // Show username modal
    this.showUsernameModal();
  }

  setupEventListeners() {
    // Username modal
    document.getElementById('join-button').addEventListener('click', () => {
      this.handleJoinRoom();
    });

    document.getElementById('username-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleJoinRoom();
      }
    });

    // Mute button
    document.getElementById('mute-button').addEventListener('click', () => {
      this.handleToggleMute();
    });

    // Copy link button
    document.getElementById('copy-link-button').addEventListener('click', () => {
      this.handleCopyLink();
    });

    // Chat
    document.getElementById('send-button').addEventListener('click', () => {
      this.handleSendMessage();
    });

    document.getElementById('chat-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleSendMessage();
      }
    });

    // Socket.IO callbacks
    this.socketManager.on('roomJoined', (data) => this.handleRoomJoined(data));
    this.socketManager.on('userJoined', (data) => this.handleUserJoined(data));
    this.socketManager.on('userLeft', (data) => this.handleUserLeft(data));
    this.socketManager.on('userKicked', (data) => this.handleUserKicked(data));
    this.socketManager.on('youWereKicked', () => this.handleYouWereKicked());
    this.socketManager.on('receiveMessage', (data) => this.handleReceiveMessage(data));
    this.socketManager.on('userMuted', (data) => this.handleUserMuted(data));
    this.socketManager.on('webrtcOffer', (data) => this.webrtcManager.handleOffer(data.from, data.offer));
    this.socketManager.on('webrtcAnswer', (data) => this.webrtcManager.handleAnswer(data.from, data.answer));
    this.socketManager.on('iceCandidate', (data) => this.webrtcManager.handleICECandidate(data.from, data.candidate));

    // WebRTC callbacks
    this.webrtcManager.on('speaking', (socketId, isSpeaking) => this.handleSpeaking(socketId, isSpeaking));
  }

  showUsernameModal() {
    document.getElementById('username-modal').classList.remove('hidden');
    document.getElementById('username-input').focus();
  }

  hideUsernameModal() {
    document.getElementById('username-modal').classList.add('hidden');
  }

  async handleJoinRoom() {
    const usernameInput = document.getElementById('username-input');
    const username = usernameInput.value.trim();

    if (!username) {
      document.getElementById('username-error').textContent = 'Please enter a username';
      return;
    }

    this.username = username;

    // Initialize WebRTC
    const success = await this.webrtcManager.initialize();
    if (!success) {
      document.getElementById('username-error').textContent = 'Cannot access microphone';
      return;
    }

    // Connect to server
    this.socketManager.connect();

    // Generate peer ID (use socket ID later)
    const peerId = Math.random().toString(36).substring(7);

    // Join room
    this.socketManager.joinRoom(this.roomId, username, peerId);

    // Hide modal and show app
    this.hideUsernameModal();
    document.getElementById('app').classList.remove('hidden');

    // Update UI
    document.getElementById('room-id-display').textContent = `Room: ${this.roomId.substring(0, 8)}...`;
  }

  handleRoomJoined(data) {
    console.log('Room joined:', data);

    // Add yourself to the participant list UI
    this.addParticipantToUI({
      socketId: this.socketManager.socket.id,
      username: this.username,
      peerId: 'local',
      isMuted: false
    }, true); // true = isYou

    // Add existing participants
    data.participants.forEach(participant => {
      this.participants.set(participant.socketId, participant);
      this.addParticipantToUI(participant);

      // Create peer connection as initiator
      this.webrtcManager.createPeerConnection(participant.socketId, true);
    });

    this.updateParticipantCount();

    // Add system message
    this.addSystemMessage('You joined the room');
  }

  handleUserJoined(data) {
    console.log('User joined:', data);

    // Add to participants
    this.participants.set(data.socketId, {
      username: data.username,
      peerId: data.peerId,
      isMuted: false
    });

    this.addParticipantToUI({
      socketId: data.socketId,
      username: data.username,
      peerId: data.peerId,
      isMuted: false
    });

    this.updateParticipantCount();

    // Add system message
    this.addSystemMessage(`${data.username} joined the room`);

    // Note: WebRTC connection will be initiated by the new user
  }

  handleUserLeft(data) {
    console.log('User left:', data);

    const participant = this.participants.get(data.socketId);
    if (participant) {
      this.addSystemMessage(`${participant.username} left the room`);
    }

    // Remove from participants
    this.participants.delete(data.socketId);
    this.removeParticipantFromUI(data.socketId);
    this.updateParticipantCount();

    // Remove WebRTC connection
    this.webrtcManager.removePeer(data.socketId);
  }

  handleUserKicked(data) {
    console.log('User kicked:', data);

    const participant = this.participants.get(data.socketId);
    if (participant) {
      this.addSystemMessage(`${participant.username} was kicked from the room`);
    }

    // Remove from participants
    this.participants.delete(data.socketId);
    this.removeParticipantFromUI(data.socketId);
    this.updateParticipantCount();

    // Remove WebRTC connection
    this.webrtcManager.removePeer(data.socketId);
  }

  handleYouWereKicked() {
    console.log('You were kicked');

    // Clean up
    this.webrtcManager.cleanup();

    // Hide app and show kicked modal
    document.getElementById('app').classList.add('hidden');
    document.getElementById('kicked-modal').classList.remove('hidden');
  }

  handleReceiveMessage(data) {
    this.addChatMessage(data.username, data.message, data.timestamp, data.socketId);
  }

  handleUserMuted(data) {
    const participant = this.participants.get(data.socketId);
    if (participant) {
      participant.isMuted = data.isMuted;
      this.updateParticipantUI(data.socketId);
    }
  }

  handleSpeaking(socketId, isSpeaking) {
    const participantElement = document.querySelector(`[data-socket-id="${socketId}"]`);
    if (participantElement) {
      if (isSpeaking) {
        participantElement.classList.add('speaking');
      } else {
        participantElement.classList.remove('speaking');
      }
    }
  }

  handleToggleMute() {
    const isMuted = this.webrtcManager.toggleMute();
    const button = document.getElementById('mute-button');
    const icon = document.getElementById('mute-icon');
    const text = document.getElementById('mute-text');

    if (isMuted) {
      button.classList.add('muted');
      icon.textContent = '🔇';
      text.textContent = 'Unmute';
    } else {
      button.classList.remove('muted');
      icon.textContent = '🎤';
      text.textContent = 'Mute';
    }
  }

  handleCopyLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      const button = document.getElementById('copy-link-button');
      button.textContent = '✓';
      setTimeout(() => {
        button.textContent = '📋';
      }, 2000);
    });
  }

  handleSendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (!message) return;

    this.socketManager.sendMessage(message);
    input.value = '';
  }

  addParticipantToUI(participant, isYou = false) {
    const participantsList = document.getElementById('participants-list');

    const div = document.createElement('div');
    div.className = 'participant';
    div.dataset.socketId = participant.socketId;

    const info = document.createElement('div');
    info.className = 'participant-info';

    const name = document.createElement('span');
    name.className = 'participant-name';
    name.textContent = participant.username;

    const status = document.createElement('span');
    status.className = 'participant-status';
    status.textContent = participant.isMuted ? '(muted)' : '';

    info.appendChild(name);
    info.appendChild(status);

    // Add badge if this is you
    if (isYou || participant.socketId === this.socketManager.socket.id) {
      const badge = document.createElement('span');
      badge.className = 'participant-badge';
      badge.textContent = this.socketManager.isCreator ? 'You (Creator)' : 'You';
      info.appendChild(badge);
    }

    div.appendChild(info);

    // Add kick button if current user is creator and this is not you
    if (this.socketManager.isCreator && participant.socketId !== this.socketManager.socket.id) {
      const actions = document.createElement('div');
      actions.className = 'participant-actions';

      const kickButton = document.createElement('button');
      kickButton.textContent = 'Kick';
      kickButton.addEventListener('click', () => {
        this.handleKickUser(participant.socketId);
      });

      actions.appendChild(kickButton);
      div.appendChild(actions);
    }

    participantsList.appendChild(div);
  }

  removeParticipantFromUI(socketId) {
    const participantElement = document.querySelector(`[data-socket-id="${socketId}"]`);
    if (participantElement) {
      participantElement.remove();
    }
  }

  updateParticipantUI(socketId) {
    const participant = this.participants.get(socketId);
    if (!participant) return;

    const participantElement = document.querySelector(`[data-socket-id="${socketId}"]`);
    if (!participantElement) return;

    const status = participantElement.querySelector('.participant-status');
    if (status) {
      status.textContent = participant.isMuted ? '(muted)' : '';
    }
  }

  updateParticipantCount() {
    // Count actual participant elements in the DOM
    const count = document.querySelectorAll('.participant').length;
    document.getElementById('participant-count').textContent = count;
  }

  handleKickUser(socketId) {
    if (confirm('Are you sure you want to kick this user?')) {
      this.socketManager.kickUser(socketId);
    }
  }

  addChatMessage(username, message, timestamp, socketId) {
    const chatMessages = document.getElementById('chat-messages');

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';

    const header = document.createElement('div');
    header.className = 'chat-message-header';

    const usernameSpan = document.createElement('span');
    usernameSpan.className = 'chat-message-username';
    usernameSpan.textContent = username;

    const time = document.createElement('span');
    time.className = 'chat-message-time';
    time.textContent = new Date(timestamp).toLocaleTimeString();

    header.appendChild(usernameSpan);
    header.appendChild(time);

    const text = document.createElement('div');
    text.className = 'chat-message-text';
    text.textContent = message;

    messageDiv.appendChild(header);
    messageDiv.appendChild(text);

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  addSystemMessage(message) {
    const chatMessages = document.getElementById('chat-messages');

    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.textContent = message;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
  const app = new ConcordApp();
  app.initialize();
});
