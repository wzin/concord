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

    // Sidebar toggle
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
      this.handleSidebarToggle();
    });

    // Sidebar close button
    document.getElementById('sidebar-close').addEventListener('click', () => {
      this.handleSidebarClose();
    });

    // Sidebar backdrop (click outside to close)
    document.getElementById('sidebar-backdrop').addEventListener('click', () => {
      this.handleSidebarClose();
    });

    // Footer toggle (mobile)
    document.getElementById('footer-toggle').addEventListener('click', () => {
      this.handleFooterToggle();
    });

    // Camera button
    document.getElementById('camera-button').addEventListener('click', () => {
      this.handleToggleCamera();
    });

    // Mute button
    document.getElementById('mute-button').addEventListener('click', () => {
      this.handleToggleMute();
    });

    // Gain slider
    document.getElementById('gain-slider').addEventListener('input', (e) => {
      this.handleGainChange(e.target.value);
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
    this.webrtcManager.on('peerConnected', (socketId, stream) => this.handlePeerStream(socketId, stream));
    this.webrtcManager.on('peerDisconnected', (socketId) => this.handlePeerDisconnected(socketId));
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

    // Get media preferences
    const enableVideo = document.getElementById('video-toggle-join').checked;
    const enableAudio = document.getElementById('audio-toggle-join').checked;

    // Initialize WebRTC with user preferences
    const success = await this.webrtcManager.initialize(enableVideo, enableAudio);
    if (!success) {
      document.getElementById('username-error').textContent = 'Cannot access media devices';
      return;
    }

    // Show/hide camera button based on whether video is enabled
    const cameraButton = document.getElementById('camera-button');
    if (enableVideo) {
      cameraButton.style.display = 'flex';
    } else {
      cameraButton.style.display = 'none';
    }

    // Display local video if enabled
    if (enableVideo) {
      this.addVideoContainer('local', this.username, this.webrtcManager.localStream, true);
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

    // Hide sidebar by default on mobile
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.add('hidden-sidebar');
      document.getElementById('sidebar-backdrop').classList.add('hidden-sidebar');
    }
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

    // Remove video container
    this.removeVideoContainer(data.socketId);

    // Remove WebRTC connection
    this.webrtcManager.removePeer(data.socketId);
  }

  handlePeerStream(socketId, stream) {
    console.log('Received stream from peer:', socketId);

    // Safety check: never play back our own audio
    if (this.socketManager.socket && socketId === this.socketManager.socket.id) {
      console.warn('Attempted to play back local stream - ignoring');
      return;
    }

    // Get participant info
    const participant = this.participants.get(socketId);
    if (participant) {
      // Add video container for this peer
      this.addVideoContainer(socketId, participant.username, stream, false);
    }

    // Create audio element for remote audio (hidden)
    const audio = document.createElement('audio');
    audio.id = `audio-${socketId}`;
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.playsInline = true;
    document.body.appendChild(audio);
  }

  handlePeerDisconnected(socketId) {
    console.log('Peer disconnected:', socketId);
    this.removeVideoContainer(socketId);

    // Remove audio element
    const audio = document.getElementById(`audio-${socketId}`);
    if (audio) {
      audio.remove();
    }
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

    // Show sidebar when message received so user knows there's a new message
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar.classList.contains('hidden-sidebar')) {
      sidebar.classList.remove('hidden-sidebar');
      backdrop.classList.remove('hidden-sidebar');
    }
  }

  handleUserMuted(data) {
    const participant = this.participants.get(data.socketId);
    if (participant) {
      participant.isMuted = data.isMuted;
      this.updateParticipantUI(data.socketId);
    }
  }

  handleSpeaking(socketId, isSpeaking) {
    // Handle local user speaking indicator
    if (socketId === 'local') {
      socketId = this.socketManager.socket ? this.socketManager.socket.id : null;
    }

    if (!socketId) return;

    const participantElement = document.querySelector(`[data-socket-id="${socketId}"]`);
    if (participantElement) {
      if (isSpeaking) {
        participantElement.classList.add('speaking');

        // Add or update mic icon
        let micIcon = participantElement.querySelector('.participant-mic-icon');
        if (!micIcon) {
          micIcon = document.createElement('span');
          micIcon.className = 'participant-mic-icon';
          micIcon.textContent = '🎤';
          micIcon.title = 'Speaking';

          const participantInfo = participantElement.querySelector('.participant-info');
          if (participantInfo) {
            participantInfo.appendChild(micIcon);
          }
        }
        micIcon.classList.add('active');
      } else {
        participantElement.classList.remove('speaking');

        // Deactivate mic icon but keep it visible
        const micIcon = participantElement.querySelector('.participant-mic-icon');
        if (micIcon) {
          micIcon.classList.remove('active');
        }
      }
    }
  }

  handleSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    sidebar.classList.toggle('hidden-sidebar');
    backdrop.classList.toggle('hidden-sidebar');
  }

  handleSidebarClose() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    sidebar.classList.add('hidden-sidebar');
    backdrop.classList.add('hidden-sidebar');
  }

  handleFooterToggle() {
    const footer = document.getElementById('footer-controls');
    const toggleButton = document.getElementById('footer-toggle');

    footer.classList.toggle('collapsed');

    // Update toggle button icon
    if (footer.classList.contains('collapsed')) {
      toggleButton.textContent = '▼';
    } else {
      toggleButton.textContent = '▲';
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

  handleGainChange(value) {
    // Slider value is 0-300, convert to 0-3.0 gain
    const gainValue = value / 100;
    this.webrtcManager.setGain(gainValue);

    // Update display
    document.getElementById('gain-value').textContent = value + '%';
  }

  handleToggleCamera() {
    const isCameraOff = this.webrtcManager.toggleCamera();
    const button = document.getElementById('camera-button');
    const icon = document.getElementById('camera-icon');
    const text = document.getElementById('camera-text');

    if (isCameraOff) {
      button.classList.add('camera-off');
      icon.textContent = '📹';
      text.textContent = 'Camera Off';

      // Hide local video
      const localVideo = document.querySelector('[data-video-id="local"] video');
      if (localVideo) {
        localVideo.style.display = 'none';
      }
      const localContainer = document.querySelector('[data-video-id="local"]');
      if (localContainer) {
        localContainer.classList.add('audio-only');
      }
    } else {
      button.classList.remove('camera-off');
      icon.textContent = '📹';
      text.textContent = 'Camera';

      // Show local video
      const localVideo = document.querySelector('[data-video-id="local"] video');
      if (localVideo) {
        localVideo.style.display = 'block';
      }
      const localContainer = document.querySelector('[data-video-id="local"]');
      if (localContainer) {
        localContainer.classList.remove('audio-only');
      }
    }
  }

  addVideoContainer(id, username, stream, isLocal = false) {
    const videoGrid = document.getElementById('video-grid');

    // Check if container already exists
    let container = document.querySelector(`[data-video-id="${id}"]`);
    if (container) {
      // Update existing container
      const video = container.querySelector('video');
      if (video) {
        video.srcObject = stream;
      }
      return;
    }

    // Create new container
    container = document.createElement('div');
    container.className = 'video-container';
    container.dataset.videoId = id;

    // Check if stream has video tracks
    const hasVideo = stream && stream.getVideoTracks().length > 0;

    if (hasVideo) {
      const video = document.createElement('video');
      video.muted = isLocal; // Mute local video to avoid feedback - set BEFORE srcObject
      video.autoplay = true;
      video.playsInline = true;
      video.srcObject = stream;
      container.appendChild(video);
    } else {
      // Audio-only: show avatar
      container.classList.add('audio-only');
      const avatar = document.createElement('div');
      avatar.className = 'video-avatar';
      avatar.textContent = username.charAt(0).toUpperCase();
      container.appendChild(avatar);
    }

    // Add label
    const label = document.createElement('div');
    label.className = 'video-label';
    label.innerHTML = `<span>${username}${isLocal ? ' (You)' : ''}</span><span class="mic-indicator">🎤</span>`;
    container.appendChild(label);

    videoGrid.appendChild(container);
  }

  removeVideoContainer(id) {
    const container = document.querySelector(`[data-video-id="${id}"]`);
    if (container) {
      container.remove();
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
