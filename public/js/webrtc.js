// WebRTC Manager using SimplePeer
class WebRTCManager {
  constructor(socketManager) {
    this.socketManager = socketManager;
    this.localStream = null;
    this.processedStream = null; // Stream with gain applied
    this.audioContext = null;
    this.gainNode = null;
    this.peers = new Map(); // socketId -> SimplePeer instance
    this.isMuted = false;
    this.hasVideo = false;
    this.isCameraOff = false;
    this.iceServers = null; // Will be fetched from server
    this.callbacks = {
      peerConnected: null,
      peerDisconnected: null,
      speaking: null
    };
  }

  async fetchTurnConfig() {
    try {
      const response = await fetch('/api/turn-credentials');
      const config = await response.json();
      this.iceServers = config.iceServers;
      console.log('✅ TURN configuration loaded from server');
    } catch (error) {
      console.error('❌ Failed to fetch TURN config:', error);
      // Fallback to basic STUN
      this.iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
    }
  }

  async initialize(enableVideo = false, enableAudio = true) {
    try {
      this.hasVideo = enableVideo;

      const constraints = {
        audio: enableAudio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false, // Disable browser AGC so we can control gain manually
          sampleRate: 48000
        } : false,
        video: enableVideo ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false
      };

      // Get local media stream
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      console.log('Local media stream obtained (video:', enableVideo, ', audio:', enableAudio, ')');

      if (enableAudio) {
        // Set up Web Audio API for manual gain control
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = this.audioContext.createMediaStreamSource(this.localStream);

        // Create gain node for manual volume control
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = 1.0; // Default 100%

        // Create destination to get processed stream
        const destination = this.audioContext.createMediaStreamDestination();

        // Connect: source -> gain -> destination
        source.connect(this.gainNode);
        this.gainNode.connect(destination);

        // If we have video, add video track to processed stream
        if (enableVideo) {
          const videoTrack = this.localStream.getVideoTracks()[0];
          if (videoTrack) {
            destination.stream.addTrack(videoTrack);
          }
        }

        // This is the stream with gain applied that we'll send to peers
        this.processedStream = destination.stream;

        console.log('Audio gain control initialized');

        // Start monitoring local audio input (use original stream for monitoring)
        this.monitorLocalAudio();
      } else {
        // No audio, just use the raw stream
        this.processedStream = this.localStream;
      }

      return true;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Cannot access microphone. Please grant permission and refresh.');
      return false;
    }
  }

  // Set microphone gain (0-3.0, where 1.0 = 100%)
  setGain(gainValue) {
    if (this.gainNode) {
      this.gainNode.gain.value = gainValue;
      console.log('Microphone gain set to:', gainValue);
    }
  }

  // Monitor local audio input level
  monitorLocalAudio() {
    // Reuse existing audioContext
    const analyser = this.audioContext.createAnalyser();
    const microphone = this.audioContext.createMediaStreamSource(this.localStream);

    microphone.connect(analyser);
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;

    const dataArray = new Uint8Array(analyser.fftSize);
    let isLocalSpeaking = false;

    // Dynamic range tracking
    let maxVolume = 0;
    let minVolume = 255;
    let volumeHistory = [];
    const historyLength = 100; // Track last 100 samples

    const checkLocalAudioLevel = () => {
      if (!this.localStream) return;

      // Use time-domain data for better volume detection
      analyser.getByteTimeDomainData(dataArray);

      // Calculate RMS (Root Mean Square) for accurate volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128; // Normalize to -1 to 1
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const volume = rms * 255; // Scale back to 0-255 range

      // Track volume history for dynamic scaling
      volumeHistory.push(volume);
      if (volumeHistory.length > historyLength) {
        volumeHistory.shift();
      }

      // Update min/max with some decay to adapt to changing conditions
      if (volume > maxVolume) {
        maxVolume = volume;
      } else {
        maxVolume = maxVolume * 0.999; // Slowly decay max
      }

      if (volume < minVolume && volume > 0) {
        minVolume = volume;
      }

      // Ensure minimum range
      const range = Math.max(maxVolume - minVolume, 20);

      // Scale volume to percentage using dynamic range
      let percentage = 0;
      if (range > 0) {
        percentage = Math.min(100, Math.max(0, ((volume - minVolume) / range) * 100));
      }

      // Apply non-linear scaling for better visual feedback
      percentage = Math.pow(percentage / 100, 0.7) * 100;

      // Update visual mic level bar
      const micLevelFill = document.getElementById('mic-level-fill');
      const micInputIcon = document.getElementById('mic-input-icon');
      const speakerOutputIcon = document.getElementById('speaker-output-icon');

      if (micLevelFill) {
        micLevelFill.style.width = percentage + '%';
      }

      // Adaptive threshold based on recent history
      const avgVolume = volumeHistory.reduce((a, b) => a + b, 0) / volumeHistory.length;
      const threshold = Math.max(5, avgVolume * 1.5); // 150% of average
      const newIsLocalSpeaking = volume > threshold && !this.isMuted;

      // Update status icons
      if (micInputIcon) {
        if (this.isMuted) {
          micInputIcon.className = 'mic-status-icon muted';
        } else if (newIsLocalSpeaking) {
          micInputIcon.className = 'mic-status-icon active';
        } else {
          micInputIcon.className = 'mic-status-icon';
        }
      }

      // Speaker output icon is active when there are active peers
      if (speakerOutputIcon) {
        const hasActivePeers = this.peers.size > 0;
        if (hasActivePeers) {
          speakerOutputIcon.className = 'mic-status-icon active';
        } else {
          speakerOutputIcon.className = 'mic-status-icon';
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
      stream: this.processedStream, // Use processed stream with gain applied
      trickle: true,
      config: {
        iceServers: this.iceServers, // Use TURN config from server
        iceTransportPolicy: 'all', // Try direct P2P first, fall back to TURN
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      },
      offerOptions: {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      },
      answerOptions: {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      }
    });

    // Store peer
    this.peers.set(remoteSocketId, peer);

    // Handle signaling data (offer/answer)
    peer.on('signal', (data) => {
      if (data.type === 'offer') {
        console.log('📤 Sending offer to', remoteSocketId);
        this.socketManager.sendWebRTCOffer(remoteSocketId, data);
      } else if (data.type === 'answer') {
        console.log('📤 Sending answer to', remoteSocketId);
        this.socketManager.sendWebRTCAnswer(remoteSocketId, data);
      } else if (data.candidate) {
        // ICE candidate
        const candidateStr = typeof data.candidate === 'string' ? data.candidate : data.candidate.candidate || '';
        const candidateType = candidateStr.includes('relay') ? '🔄 RELAY' :
                             candidateStr.includes('srflx') ? '🌐 SRFLX' :
                             candidateStr.includes('host') ? '🏠 HOST' : '❓ UNKNOWN';
        console.log(`📤 ICE candidate ${candidateType}:`, remoteSocketId, candidateStr.substring(0, 50) + '...');
        this.socketManager.sendICECandidate(remoteSocketId, data);
      }
    });

    // Handle incoming stream
    peer.on('stream', (remoteStream) => {
      console.log('Received remote stream from', remoteSocketId);

      // Detect speaking for this stream
      this.detectSpeaking(remoteSocketId, remoteStream);

      // Notify the app about the new stream
      if (this.callbacks.peerConnected) {
        this.callbacks.peerConnected(remoteSocketId, remoteStream);
      }
    });

    // Handle connection established
    peer.on('connect', () => {
      console.log('✅ Peer connected:', remoteSocketId);
    });

    // Handle errors
    peer.on('error', (err) => {
      console.error('❌ Peer error:', remoteSocketId, err);
      this.removePeer(remoteSocketId);
    });

    // Handle close
    peer.on('close', () => {
      console.log('🔌 Peer connection closed:', remoteSocketId);
      this.removePeer(remoteSocketId);
    });

    // Debug ICE connection state
    if (peer._pc) {
      peer._pc.oniceconnectionstatechange = () => {
        console.log('🧊 ICE connection state:', remoteSocketId, peer._pc.iceConnectionState);
      };
      peer._pc.onicegatheringstatechange = () => {
        console.log('📡 ICE gathering state:', remoteSocketId, peer._pc.iceGatheringState);
      };
      peer._pc.onconnectionstatechange = () => {
        console.log('🔗 Connection state:', remoteSocketId, peer._pc.connectionState);
      };
    }

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
      if (candidate.candidate) {
        const candidateStr = typeof candidate.candidate === 'string' ? candidate.candidate : candidate.candidate.candidate || '';
        const candidateType = candidateStr.includes('relay') ? '🔄 RELAY' :
                             candidateStr.includes('srflx') ? '🌐 SRFLX' :
                             candidateStr.includes('host') ? '🏠 HOST' : '❓ UNKNOWN';
        console.log(`📥 ICE candidate ${candidateType}:`, fromSocketId, candidateStr.substring(0, 50) + '...');
      }
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

    microphone.connect(analyser);
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;

    const dataArray = new Uint8Array(analyser.fftSize);
    let isSpeaking = false;
    let volumeHistory = [];
    const historyLength = 50;

    const checkAudioLevel = () => {
      // Use time-domain data for better volume detection
      analyser.getByteTimeDomainData(dataArray);

      // Calculate RMS (Root Mean Square) for accurate volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const volume = rms * 255;

      // Track volume history
      volumeHistory.push(volume);
      if (volumeHistory.length > historyLength) {
        volumeHistory.shift();
      }

      // Adaptive threshold based on recent history
      const avgVolume = volumeHistory.reduce((a, b) => a + b, 0) / volumeHistory.length;
      const threshold = Math.max(5, avgVolume * 1.5);
      const newIsSpeaking = volume > threshold;

      if (newIsSpeaking !== isSpeaking) {
        isSpeaking = newIsSpeaking;
        console.log(`Remote ${socketId} speaking:`, isSpeaking, 'Volume:', volume.toFixed(2), 'Threshold:', threshold.toFixed(2));
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

  // Toggle camera
  toggleCamera() {
    if (!this.localStream || !this.hasVideo) return false;

    this.isCameraOff = !this.isCameraOff;

    // Enable/disable video track
    this.localStream.getVideoTracks().forEach(track => {
      track.enabled = !this.isCameraOff;
    });

    // Also update processed stream if it exists
    if (this.processedStream) {
      this.processedStream.getVideoTracks().forEach(track => {
        track.enabled = !this.isCameraOff;
      });
    }

    console.log('Camera', this.isCameraOff ? 'OFF' : 'ON');
    return this.isCameraOff;
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

    if (this.processedStream) {
      this.processedStream.getTracks().forEach(track => track.stop());
      this.processedStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  on(event, callback) {
    if (this.callbacks.hasOwnProperty(event)) {
      this.callbacks[event] = callback;
    }
  }
}
