# Technical Context for Claude

## Project: Concord Voice Chat Application

### Purpose
This document contains technical decisions, implementation notes, and context that should persist across AI-assisted development sessions.

---

## Key Technical Decisions

### Why Peer-to-Peer WebRTC (Mesh Topology)?
- **Room size**: 2-5 users maximum
- **Cost**: No media server required (free deployment)
- **Latency**: Direct peer connections = lower latency
- **Tradeoff**: Mesh doesn't scale beyond ~5-7 users (each user connects to every other user)

**Alternative considered**: SFU (Selective Forwarding Unit) like mediasoup - rejected due to server costs and complexity

### Why In-Memory Storage?
- **Simplicity**: No database setup or management
- **Speed**: Instant access to room data
- **Tradeoff**: Rooms lost on server restart (acceptable per requirements)
- **Future**: Could add Redis for persistence if needed

### Why Socket.IO?
- **WebRTC signaling**: Need real-time bidirectional communication
- **Text chat**: Need message broadcasting
- **User events**: Need to broadcast join/leave/kick
- **Fallback**: Socket.IO handles WebSocket with fallbacks

### Why Vanilla JavaScript?
- **Simplicity**: No build step, no framework overhead
- **Learning**: Easy for others to understand and modify
- **Performance**: Minimal bundle size
- **Tradeoff**: More verbose than React/Vue, but project is small

---

## Architecture Decisions

### Room ID Generation
- **Method**: UUID v4
- **Reason**: Cryptographically random, hard to guess
- **Format**: `https://concord.app/{uuid}`
- **Library**: Use `crypto.randomUUID()` (built into Node.js 14.17+)

### Username Sanitization
```javascript
// Sanitize username
function sanitizeUsername(username) {
  return username
    .trim()
    .slice(0, 50)
    .replace(/[^a-zA-Z0-9\s\-\_\.]/g, '');
}
```

### WebRTC Connection Flow
1. User A joins room → gets list of existing peers
2. User A creates offer for each peer → sends via Socket.IO
3. Peer B receives offer → creates answer → sends back
4. ICE candidates exchanged through Socket.IO
5. Direct P2P connection established

### Handling User Disconnects
- **Socket disconnect**: Remove user from room, notify others
- **Network issues**: Socket.IO auto-reconnect (5 attempts)
- **WebRTC failure**: Fall back to rejoin room

---

## Data Structures

### Server-Side Room Storage
```javascript
const rooms = new Map(); // roomId -> Room

class Room {
  constructor(id, creatorSocketId) {
    this.id = id;
    this.creator = creatorSocketId;
    this.participants = new Map(); // socketId -> Participant
    this.createdAt = Date.now();
  }
}

class Participant {
  constructor(socketId, username, peerId) {
    this.socketId = socketId;
    this.username = username;
    this.peerId = peerId;
    this.isMuted = false;
  }
}
```

### Client-Side State
```javascript
const appState = {
  roomId: null,
  username: null,
  isCreator: false,
  isMuted: false,
  localStream: null,
  peers: new Map(), // peerId -> RTCPeerConnection
  participants: new Map() // socketId -> {username, peerId}
};
```

---

## Socket.IO Events

### Client → Server
- `join-room`: Join a room (params: roomId, username)
- `webrtc-offer`: Send WebRTC offer (params: to, offer)
- `webrtc-answer`: Send WebRTC answer (params: to, answer)
- `ice-candidate`: Send ICE candidate (params: to, candidate)
- `send-message`: Send text message (params: message)
- `kick-user`: Kick a user (params: targetSocketId)
- `toggle-mute`: Toggle mute status (params: isMuted)

### Server → Client
- `room-joined`: Confirmation of join (params: participants, isCreator)
- `user-joined`: New user joined (params: socketId, username, peerId)
- `user-left`: User left (params: socketId)
- `user-kicked`: User was kicked (params: socketId)
- `webrtc-offer`: Received WebRTC offer (params: from, offer)
- `webrtc-answer`: Received WebRTC answer (params: from, answer)
- `ice-candidate`: Received ICE candidate (params: from, candidate)
- `receive-message`: New text message (params: username, message, timestamp)
- `error`: Error occurred (params: message)

---

## Deployment Configuration (Render.com)

### Environment Variables
- `PORT`: Auto-set by Render (usually 10000)
- `NODE_ENV`: Set to `production`

### Build Command
```bash
cd server && npm install
```

### Start Command
```bash
node server/index.js
```

### Static Files
- Express serves `/public` directory
- All frontend files in `/public`

---

## Security Considerations

### XSS Prevention
- Sanitize all usernames
- Escape HTML in text messages
- Use `textContent` instead of `innerHTML` for user input

### Room Hijacking Prevention
- Room IDs are UUIDs (hard to guess)
- No room listing endpoint
- Creator tracked by socket ID (changes on reconnect)

### DOS Prevention
- Rate limit room creation (TODO: implement if abused)
- Limit message length (1000 chars)
- Limit username length (50 chars)

---

## Browser Compatibility

### Required APIs
- WebRTC (RTCPeerConnection, getUserMedia)
- WebSocket (via Socket.IO)
- ES6 JavaScript

### Tested Browsers
- Chrome/Edge: ✓ (primary target)
- Firefox: ✓
- Safari: ✓ (with minor quirks)
- Mobile: TBD

---

## Known Limitations

1. **No persistence**: Rooms disappear on server restart
2. **No recording**: Voice and text not saved
3. **No video**: Audio only
4. **Mesh topology**: Scales poorly beyond 5 users
5. **No reconnect**: If WebRTC fails, must rejoin
6. **Creator transfer**: If creator leaves, no new creator assigned
7. **No room passwords**: Anyone with URL can join

---

## Future Enhancements (Out of Scope)

- [ ] Room passwords
- [ ] Persistent rooms (add Redis)
- [ ] Video chat
- [ ] Screen sharing
- [ ] Recording
- [ ] Room discovery/listing
- [ ] User accounts
- [ ] Reactions/emojis
- [ ] File sharing
- [ ] Mobile app (React Native)

---

## Development Notes

### Local Testing
```bash
# Terminal 1: Start server
cd server && npm install && npm start

# Terminal 2: Open multiple browsers
# Navigate to http://localhost:3000
```

### Multi-User Testing
- Open multiple browser windows/profiles
- Copy room URL between windows
- Test voice, text, mute, kick

### Debugging WebRTC
- Chrome: `chrome://webrtc-internals`
- Firefox: `about:webrtc`
- Check ICE connection state, candidate gathering

---

## Questions for Future Development

1. Should we add a "copy room URL" button?
2. Should we show connection quality indicators?
3. Should we add sound effects for join/leave?
4. Should we add a "raise hand" feature?
5. Should we allow room names (instead of UUIDs)?

---

## Repository Information

- **GitHub**: git@github.com:wzin/concord.git
- **Branch**: main
- **Deployment**: Render.com (URL TBD after deployment)

---

Last updated: 2025-10-08
