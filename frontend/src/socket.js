import { io } from 'socket.io-client';

const BACKEND_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://techweb2.onrender.com';

const socket = io(BACKEND_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

export { BACKEND_URL };
export default socket;
