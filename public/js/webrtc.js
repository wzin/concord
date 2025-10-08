// WebRTC Manager using SimplePeer
class WebRTCManager {
  constructor(socketManager) {
    this.socketManager = socketManager;
    this.localStream = null;
    this.peers = new Map(); // socketId -> SimplePeer instance
    this.isMuted = false;
    this.callbacks = {
      peerConnected: null,
      peerDisconnected: null,
      speaking: null
    };
  }

  async initialize() {
    try {
      // Get local audio stream
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      console.log('Local audio stream obtained');

      // Start monitoring local audio input
      this.monitorLocalAudio();

      return true;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Cannot access microphone. Please grant permission and refresh.');
      return false;
    }
  }

  // Monitor local audio input level
  monitorLocalAudio() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(this.localStream);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    microphone.connect(analyser);
    analyser.fftSize = 256;

    let isLocalSpeaking = false;

    const checkLocalAudioLevel = () => {
      if (!this.localStream) return;

      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

      // Update visual mic level bar
      const micLevelFill = document.getElementById('mic-level-fill');
      const micStatus = document.getElementById('mic-status');

      if (micLevelFill) {
        // Scale average (0-255) to percentage (0-100)
        const percentage = Math.min(100, (average / 128) * 100);
        micLevelFill.style.width = percentage + '%';
      }

      // Threshold for detecting speaking
      const threshold = 20;
      const newIsLocalSpeaking = average > threshold && !this.isMuted;

      // Update status text
      if (micStatus) {
        if (this.isMuted) {
          micStatus.textContent = 'Muted';
          micStatus.className = 'mic-status muted';
        } else if (newIsLocalSpeaking) {
          micStatus.textContent = '🔊 SPEAKING';
          micStatus.className = 'mic-status speaking';
        } else {
          micStatus.textContent = 'Listening...';
          micStatus.className = 'mic-status';
        }
      }

      if (newIsLocalSpeaking !== isLocalSpeaking) {
        isLocalSpeaking = newIsLocalSpeaking;
        // Update UI for local speaking
        const muteButton = document.getElementById('mute-button');
        if (muteButton) {
          if (isLocalSpeaking) {
            muteButton.classList.add('speaking');
          } else {
            muteButton.classList.remove('speaking');
          }
        }

        // Update local participant speaking indicator
        if (this.callbacks.speaking) {
          this.callbacks.speaking('local', isLocalSpeaking);
        }
      }

      requestAnimationFrame(checkLocalAudioLevel);
    };

    checkLocalAudioLevel();
  }

  // Create a peer connection as initiator (the one making the call)
  createPeerConnection(remoteSocketId, isInitiator = false) {
    if (this.peers.has(remoteSocketId)) {
      console.log('Peer connection already exists for', remoteSocketId);
      return;
    }

    console.log(`Creating peer connection with ${remoteSocketId}, initiator: ${isInitiator}`);

    const peer = new SimplePeer({
      initiator: isInitiator,
      stream: this.localStream,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    // Store peer
    this.peers.set(remoteSocketId, peer);

    // Handle signaling data (offer/answer)
    peer.on('signal', (data) => {
      if (data.type === 'offer') {
        this.socketManager.sendWebRTCOffer(remoteSocketId, data);
      } else if (data.type === 'answer') {
        this.socketManager.sendWebRTCAnswer(remoteSocketId, data);
      } else {
        // ICE candidate
        this.socketManager.sendICECandidate(remoteSocketId, data);
      }
    });

    // Handle incoming stream
    peer.on('stream', (remoteStream) => {
      console.log('Received remote stream from', remoteSocketId);
      this.playRemoteStream(remoteSocketId, remoteStream);

      if (this.callbacks.peerConnected) {
        this.callbacks.peerConnected(remoteSocketId);
      }
    });

    // Handle connection established
    peer.on('connect', () => {
      console.log('Peer connected:', remoteSocketId);
    });

    // Handle errors
    peer.on('error', (err) => {
      console.error('Peer error:', remoteSocketId, err);
      this.removePeer(remoteSocketId);
    });

    // Handle close
    peer.on('close', () => {
      console.log('Peer connection closed:', remoteSocketId);
      this.removePeer(remoteSocketId);
    });

    return peer;
  }

  // Handle incoming WebRTC offer
  handleOffer(fromSocketId, offer) {
    console.log('Received offer from', fromSocketId);
    const peer = this.createPeerConnection(fromSocketId, false);
    if (peer) {
      peer.signal(offer);
    }
  }

  // Handle incoming WebRTC answer
  handleAnswer(fromSocketId, answer) {
    console.log('Received answer from', fromSocketId);
    const peer = this.peers.get(fromSocketId);
    if (peer) {
      peer.signal(answer);
    }
  }

  // Handle incoming ICE candidate
  handleICECandidate(fromSocketId, candidate) {
    const peer = this.peers.get(fromSocketId);
    if (peer) {
      peer.signal(candidate);
    }
  }

  // Play remote audio stream
  playRemoteStream(socketId, stream) {
    // Remove existing audio element if any
    const existingAudio = document.getElementById(`audio-${socketId}`);
    if (existingAudio) {
      existingAudio.remove();
    }

    // Create new audio element
    const audio = document.createElement('audio');
    audio.id = `audio-${socketId}`;
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.playsInline = true; // Important for iOS
    document.body.appendChild(audio);

    // Explicitly play the audio (handle autoplay policy)
    audio.play().catch(err => {
      console.error('Error playing audio:', err);
      // If autoplay fails, user interaction is required
      console.log('Audio autoplay blocked. User interaction may be required.');
    });

    // Detect speaking (using Web Audio API)
    this.detectSpeaking(socketId, stream);
  }

  // Detect speaking using audio level analysis
  detectSpeaking(socketId, stream) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    microphone.connect(analyser);
    analyser.fftSize = 256;

    let isSpeaking = false;

    const checkAudioLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

      // Threshold for detecting speaking (adjust as needed)
      const threshold = 20;
      const newIsSpeaking = average > threshold;

      if (newIsSpeaking !== isSpeaking) {
        isSpeaking = newIsSpeaking;
        console.log(`Remote ${socketId} speaking:`, isSpeaking, 'Level:', average.toFixed(2));
        if (this.callbacks.speaking) {
          this.callbacks.speaking(socketId, isSpeaking);
        }
      }

      requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  }

  // Remove peer connection
  removePeer(socketId) {
    const peer = this.peers.get(socketId);
    if (peer) {
      peer.destroy();
      this.peers.delete(socketId);
    }

    // Remove audio element
    const audio = document.getElementById(`audio-${socketId}`);
    if (audio) {
      audio.remove();
    }

    if (this.callbacks.peerDisconnected) {
      this.callbacks.peerDisconnected(socketId);
    }
  }

  // Toggle mute
  toggleMute() {
    if (!this.localStream) return;

    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = !this.isMuted;
    });

    // Notify server
    this.socketManager.toggleMute(this.isMuted);

    return this.isMuted;
  }

  // Clean up all connections
  cleanup() {
    this.peers.forEach((peer, socketId) => {
      this.removePeer(socketId);
    });

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  on(event, callback) {
    if (this.callbacks.hasOwnProperty(event)) {
      this.callbacks[event] = callback;
    }
  }
}
