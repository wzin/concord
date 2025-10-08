# Concord - Voice Chat Application

## Project Overview
Concord is a simple, ephemeral voice chat application that allows users to instantly create and join voice rooms with minimal friction.

## User Stories

### Core Functionality
1. **Auto Room Creation**
   - User opens the application homepage
   - System automatically generates a unique, hard-to-guess room ID
   - User is redirected to the room URL

2. **Room Joining**
   - User receives a room URL from someone (copy/paste)
   - User opens the URL
   - User is prompted to enter a username
   - User joins the voice room

3. **Voice Chat**
   - User can hear other participants in the room
   - User's audio is transmitted to other participants
   - User can toggle mute/unmute with a button click
   - User can see visual indicators of who's currently speaking

4. **Room Awareness**
   - User can see a list of all participants currently in the room
   - User sees notifications when someone joins the room
   - User sees notifications when someone leaves the room

5. **Text Chat**
   - User can send text messages to the room
   - User can see text messages from other participants
   - Messages are ephemeral (not persisted)

6. **Room Moderation**
   - The room creator (first person to join) has moderator privileges
   - Moderator can kick users from the room
   - When moderator leaves, room persists but loses moderation

7. **Room Sharing**
   - User can copy the room URL from the browser
   - URL is shareable via any medium (chat, email, etc.)

## Technical Requirements

### Capacity & Performance
- Support 2-5 simultaneous users per room
- Optimal performance for 2-user scenario
- Rooms persist indefinitely (until server restart)

### Username Requirements
- Required to join a room
- Input sanitization to prevent XSS attacks
- No uniqueness constraint (duplicates allowed)
- Length limits: 1-50 characters
- Only alphanumeric, spaces, and basic punctuation allowed

### Audio Requirements
- Use browser default audio input/output devices
- WebRTC for peer-to-peer voice transmission
- No audio recording or persistence

### Security
- Room IDs must be hard to guess (UUID v4 or similar)
- No authentication required
- Sanitize all user inputs (usernames, messages)

### Deployment
- Host on Render.com (free tier)
- No database required (in-memory storage)
- Auto-deploy from GitHub repository

## Technology Stack

### Frontend
- HTML5
- Vanilla JavaScript
- CSS3 for styling
- WebRTC API for voice
- Socket.IO client for real-time communication

### Backend
- Node.js
- Express.js for HTTP server
- Socket.IO for WebSocket communication
- In-memory data structures for room management

## Architecture

### Room Management
```
Room = {
  id: string,
  creator: socketId,
  participants: Map<socketId, Participant>,
  createdAt: timestamp
}

Participant = {
  socketId: string,
  username: string,
  isMuted: boolean,
  peerId: string (for WebRTC)
}
```

### Communication Flow
1. **Signaling**: Socket.IO handles WebRTC signaling (offer, answer, ICE candidates)
2. **Voice**: Peer-to-peer WebRTC connections (mesh topology)
3. **Text Chat**: Socket.IO broadcasts messages
4. **User Events**: Socket.IO broadcasts join/leave/kick events

## Implementation Plan

### Phase 1: Project Setup
- [x] Initialize Git repository
- [ ] Create project structure (frontend/backend folders)
- [ ] Set up package.json with dependencies
- [ ] Create basic Express server
- [ ] Create basic HTML/CSS/JS structure

### Phase 2: Room Management
- [ ] Implement room creation endpoint
- [ ] Implement room ID generation (UUID)
- [ ] Implement redirect from homepage to new room
- [ ] Implement room persistence in memory
- [ ] Implement username entry modal/screen

### Phase 3: Socket.IO Integration
- [ ] Set up Socket.IO on server
- [ ] Set up Socket.IO client
- [ ] Implement join room functionality
- [ ] Implement leave room functionality
- [ ] Implement participant list broadcasting

### Phase 4: WebRTC Voice Chat
- [ ] Implement WebRTC peer connection setup
- [ ] Implement signaling through Socket.IO
- [ ] Implement audio stream capture
- [ ] Implement audio stream playback
- [ ] Implement mesh connection (each peer to each peer)
- [ ] Implement mute/unmute functionality

### Phase 5: UI/UX
- [ ] Create participant list UI
- [ ] Create speaking indicator UI
- [ ] Create mute/unmute button
- [ ] Create join/leave notifications
- [ ] Create username entry form
- [ ] Style the application

### Phase 6: Text Chat
- [ ] Create text chat UI
- [ ] Implement send message functionality
- [ ] Implement receive message functionality
- [ ] Display messages in chat window

### Phase 7: Moderation
- [ ] Track room creator
- [ ] Implement kick user functionality
- [ ] Add kick button to UI (visible to creator only)
- [ ] Handle kicked user cleanup

### Phase 8: Testing & Polish
- [ ] Test with 2 users
- [ ] Test with 5 users
- [ ] Test mute/unmute
- [ ] Test kick functionality
- [ ] Test on different browsers
- [ ] Add error handling
- [ ] Add loading states

### Phase 9: Deployment
- [ ] Create Render.com account
- [ ] Configure Render.com web service
- [ ] Set up environment variables
- [ ] Deploy application
- [ ] Test production deployment
- [ ] Update README with deployment URL

## File Structure
```
concord/
├── server/
│   ├── index.js          # Express + Socket.IO server
│   ├── roomManager.js    # Room management logic
│   └── package.json      # Backend dependencies
├── public/
│   ├── index.html        # Homepage (auto-redirect)
│   ├── room.html         # Room page
│   ├── css/
│   │   └── styles.css    # Application styles
│   └── js/
│       ├── main.js       # Main application logic
│       ├── webrtc.js     # WebRTC connection management
│       └── socket.js     # Socket.IO client logic
├── .gitignore
├── LICENSE
├── REQUIREMENTS.md       # This file
├── CLAUDE.md             # Technical context for AI
└── README.md             # User-facing documentation
```

## Success Criteria
- [ ] User can create a room and get redirected automatically
- [ ] User can join a room via URL
- [ ] User must enter username before joining
- [ ] 2-5 users can voice chat simultaneously
- [ ] Users can see who's in the room
- [ ] Users can see who's speaking
- [ ] Users can mute/unmute themselves
- [ ] Users can send text messages
- [ ] Room creator can kick users
- [ ] Application is deployed and publicly accessible
