# Concord

A simple, ephemeral voice chat application built with WebRTC and Socket.IO.

## Features

- 🎤 **Instant Voice Rooms**: Create a room with a single click
- 🔗 **Easy Sharing**: Share room URLs via copy/paste
- 👥 **2-5 Participants**: Optimized for small group conversations
- 💬 **Text Chat**: Send messages alongside voice
- 🔇 **Mute/Unmute**: Toggle your microphone on/off
- 👑 **Room Moderation**: Creator can kick users
- 🔒 **Hard-to-Guess URLs**: Secure room IDs using UUIDs
- 📱 **Responsive Design**: Works on desktop and mobile browsers

## Quick Start

### Prerequisites

- Node.js 14.17.0 or higher
- Modern web browser with WebRTC support (Chrome, Firefox, Safari, Edge)

### Local Development

1. Clone the repository:
```bash
git clone git@github.com:wzin/concord.git
cd concord
```

2. Install dependencies:
```bash
cd server
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and visit:
```
http://localhost:3000
```

## How It Works

1. **Visit the homepage**: You'll be automatically redirected to a new room
2. **Enter your username**: Provide a name when joining
3. **Share the URL**: Copy and share the room link with others
4. **Start chatting**: Voice and text chat are ready to use!

## Deployment

### Render.com (Recommended)

Concord is configured for easy deployment on Render.com's free tier:

1. Fork/clone this repository to your GitHub account

2. Create a new Web Service on Render.com:
   - Connect your GitHub repository
   - **Root Directory**: Leave blank or use `/`
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `node server/index.js`
   - **Environment Variables**: None required

3. Click "Create Web Service" and wait for deployment

4. Your app will be live at `https://your-app-name.onrender.com`

### Other Platforms

The application can run on any platform that supports Node.js:

- **Heroku**: Use the same build and start commands
- **Railway**: Auto-detects Node.js configuration
- **Fly.io**: Works with default Node.js buildpack

## Technology Stack

### Frontend
- HTML5/CSS3
- Vanilla JavaScript
- Socket.IO client
- SimplePeer (WebRTC wrapper)

### Backend
- Node.js
- Express.js
- Socket.IO server

## Architecture

- **Room Management**: In-memory storage (no database required)
- **Voice Chat**: Peer-to-peer WebRTC connections (mesh topology)
- **Signaling**: Socket.IO handles WebRTC offer/answer/ICE exchange
- **Text Chat**: Socket.IO broadcasts messages

## Browser Compatibility

- ✅ Chrome/Edge 80+
- ✅ Firefox 75+
- ✅ Safari 14+
- ✅ Mobile browsers with WebRTC support

**Note**: Microphone access requires HTTPS in production.

## Limitations

- Rooms are ephemeral (lost on server restart)
- No voice/text recording or persistence
- Maximum 5 users per room (mesh topology limitation)
- No video support (audio only)
- Creator privileges lost if creator disconnects

## Development

### Project Structure

```
concord/
├── server/
│   ├── index.js          # Express + Socket.IO server
│   ├── roomManager.js    # Room management logic
│   └── package.json      # Dependencies
├── public/
│   ├── room.html         # Main room interface
│   ├── css/
│   │   └── styles.css    # Application styles
│   └── js/
│       ├── main.js       # Application logic
│       ├── socket.js     # Socket.IO client
│       └── webrtc.js     # WebRTC management
├── REQUIREMENTS.md       # Detailed requirements
├── CLAUDE.md             # Technical documentation
└── README.md             # This file
```

### Testing

To test with multiple users:

1. Start the server locally
2. Open multiple browser windows/tabs
3. Copy the room URL from first window
4. Paste into other windows
5. Enter different usernames

**Tip**: Use Chrome's incognito windows to simulate different users.

## Security

- Room IDs are UUID v4 (hard to guess)
- Usernames are sanitized to prevent XSS
- Text messages are length-limited (1000 chars)
- No room listing/discovery (privacy by obscurity)

## Contributing

Pull requests welcome! For major changes, please open an issue first.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For issues or questions:
- Open an issue on GitHub
- Check REQUIREMENTS.md for detailed specifications
- Check CLAUDE.md for technical implementation details

---

Built with ❤️ using WebRTC and Socket.IO
