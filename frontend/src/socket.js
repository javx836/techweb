import { io } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:3001';

const socket = io(BACKEND_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

export default socket;
