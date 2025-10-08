const crypto = require('crypto');

class Participant {
  constructor(socketId, username, peerId) {
    this.socketId = socketId;
    this.username = username;
    this.peerId = peerId;
    this.isMuted = false;
  }
}

class Room {
  constructor(id, creatorSocketId) {
    this.id = id;
    this.creator = creatorSocketId;
    this.participants = new Map(); // socketId -> Participant
    this.createdAt = Date.now();
  }

  addParticipant(socketId, username, peerId) {
    const participant = new Participant(socketId, username, peerId);
    this.participants.set(socketId, participant);
    return participant;
  }

  removeParticipant(socketId) {
    this.participants.delete(socketId);
  }

  getParticipant(socketId) {
    return this.participants.get(socketId);
  }

  isCreator(socketId) {
    return this.creator === socketId;
  }

  getParticipantsList() {
    return Array.from(this.participants.values()).map(p => ({
      socketId: p.socketId,
      username: p.username,
      peerId: p.peerId,
      isMuted: p.isMuted
    }));
  }

  isEmpty() {
    return this.participants.size === 0;
  }
}

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> Room
  }

  createRoom() {
    const roomId = crypto.randomUUID();
    return roomId;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  getOrCreateRoom(roomId, creatorSocketId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Room(roomId, creatorSocketId));
    }
    return this.rooms.get(roomId);
  }

  removeRoom(roomId) {
    this.rooms.delete(roomId);
  }

  sanitizeUsername(username) {
    if (!username || typeof username !== 'string') {
      return 'Anonymous';
    }
    return username
      .trim()
      .slice(0, 50)
      .replace(/[^a-zA-Z0-9\s\-\_\.]/g, '') || 'Anonymous';
  }

  sanitizeMessage(message) {
    if (!message || typeof message !== 'string') {
      return '';
    }
    return message.trim().slice(0, 1000);
  }
}

module.exports = new RoomManager();
