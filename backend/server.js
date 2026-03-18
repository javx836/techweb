const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// ─── In-Memory Data Store ───────────────────────────────────────────────────

const sessions = new Map();

function generateSessionCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return sessions.has(code) ? generateSessionCode() : code;
}

function createSession(hostSocketId) {
  const code = generateSessionCode();
  const session = {
    code,
    hostSocketId,
    participants: new Map(),
    questions: [],
    currentQuestionIndex: -1,
    currentQuestionStartTime: null,
    answers: new Map(),
    leaderboard: new Map(),
    gameMode: 'quiz',
    timerDuration: 30,
    isActive: false,
    rapidFireWinner: null,
  };
  sessions.set(code, session);
  return session;
}

function getScoreForAnswer(isCorrect, answerTime, timerDuration) {
  if (!isCorrect) return 0;
  const maxPoints = 1000;
  const timeRatio = Math.max(0, 1 - (answerTime / (timerDuration * 1000)));
  return Math.round(maxPoints * (0.5 + 0.5 * timeRatio));
}

// ─── REST Endpoints ─────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', sessions: sessions.size });
});

app.get('/api/export/:code', (req, res) => {
  const session = sessions.get(req.params.code.toUpperCase());
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const results = {
    sessionCode: session.code,
    gameMode: session.gameMode,
    questions: session.questions,
    participants: [],
    leaderboard: []
  };

  session.participants.forEach((p, id) => {
    results.participants.push({ id, name: p.name, joinedAt: p.joinedAt });
  });

  session.leaderboard.forEach((score, playerId) => {
    const participant = session.participants.get(playerId);
    if (participant) {
      results.leaderboard.push({ name: participant.name, score });
    }
  });

  results.leaderboard.sort((a, b) => b.score - a.score);
  res.json(results);
});

// ─── Socket.IO Events ──────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // ── Host Events ──

  socket.on('host:create', (data, callback) => {
    const session = createSession(socket.id);
    session.gameMode = data?.gameMode || 'quiz';
    session.timerDuration = data?.timerDuration || 30;
    socket.join(session.code);
    console.log(`Session created: ${session.code} by ${socket.id}`);
    callback({ success: true, code: session.code });
  });

  socket.on('host:addQuestions', ({ code, questions }) => {
    const session = sessions.get(code);
    if (!session || session.hostSocketId !== socket.id) return;
    session.questions = questions.map((q, i) => ({
      id: i,
      text: q.text,
      type: q.type || 'mcq',
      options: q.options || [],
      correctAnswer: q.correctAnswer,
      timeLimit: q.timeLimit || session.timerDuration,
    }));
    io.to(code).emit('game:questionsLoaded', { totalQuestions: questions.length });
  });

  socket.on('host:startGame', ({ code }) => {
    const session = sessions.get(code);
    if (!session || session.hostSocketId !== socket.id) return;
    session.isActive = true;
    session.currentQuestionIndex = -1;
    // Reset leaderboard
    session.participants.forEach((_, id) => {
      session.leaderboard.set(id, 0);
    });
    io.to(code).emit('game:started', { gameMode: session.gameMode });
  });

  socket.on('host:nextQuestion', ({ code }) => {
    const session = sessions.get(code);
    if (!session || session.hostSocketId !== socket.id) return;

    session.currentQuestionIndex++;
    const qi = session.currentQuestionIndex;

    if (qi >= session.questions.length) {
      // Game over – send final leaderboard
      const finalBoard = [];
      session.leaderboard.forEach((score, playerId) => {
        const p = session.participants.get(playerId);
        if (p) finalBoard.push({ id: playerId, name: p.name, score });
      });
      finalBoard.sort((a, b) => b.score - a.score);
      io.to(code).emit('game:finished', { leaderboard: finalBoard });
      return;
    }

    const question = session.questions[qi];
    session.currentQuestionStartTime = Date.now();
    session.answers.clear();
    session.rapidFireWinner = null;

    // Send question to students (without correct answer)
    const studentQuestion = {
      id: question.id,
      text: question.text,
      type: question.type,
      options: question.options,
      timeLimit: question.timeLimit,
      questionNumber: qi + 1,
      totalQuestions: session.questions.length,
    };

    // Send to host (with correct answer)
    socket.emit('host:questionData', {
      ...studentQuestion,
      correctAnswer: question.correctAnswer,
    });

    // Send to students
    socket.to(code).emit('game:question', studentQuestion);

    // Auto-end timer
    const timeLimit = question.timeLimit * 1000;
    setTimeout(() => {
      if (session.currentQuestionIndex === qi) {
        // Time's up for this question
        const boardSnapshot = [];
        session.leaderboard.forEach((score, playerId) => {
          const p = session.participants.get(playerId);
          if (p) boardSnapshot.push({ id: playerId, name: p.name, score });
        });
        boardSnapshot.sort((a, b) => b.score - a.score);
        io.to(code).emit('game:timeUp', { leaderboard: boardSnapshot, correctAnswer: question.correctAnswer });
      }
    }, timeLimit);
  });

  socket.on('host:kick', ({ code, participantId }) => {
    const session = sessions.get(code);
    if (!session || session.hostSocketId !== socket.id) return;
    const participant = session.participants.get(participantId);
    if (participant) {
      io.to(participantId).emit('game:kicked');
      const kickSocket = io.sockets.sockets.get(participantId);
      if (kickSocket) kickSocket.leave(code);
      session.participants.delete(participantId);
      session.leaderboard.delete(participantId);
      io.to(code).emit('game:participantLeft', {
        id: participantId,
        participants: Array.from(session.participants.entries()).map(([id, p]) => ({ id, name: p.name }))
      });
    }
  });

  socket.on('host:endGame', ({ code }) => {
    const session = sessions.get(code);
    if (!session || session.hostSocketId !== socket.id) return;
    const finalBoard = [];
    session.leaderboard.forEach((score, playerId) => {
      const p = session.participants.get(playerId);
      if (p) finalBoard.push({ id: playerId, name: p.name, score });
    });
    finalBoard.sort((a, b) => b.score - a.score);
    io.to(code).emit('game:finished', { leaderboard: finalBoard });
    session.isActive = false;
  });

  // ── Student Events ──

  socket.on('student:join', ({ code, name }, callback) => {
    const sessionCode = code.toUpperCase();
    const session = sessions.get(sessionCode);
    if (!session) {
      return callback({ success: false, error: 'Session not found' });
    }

    // Check duplicate name
    let nameExists = false;
    session.participants.forEach((p) => {
      if (p.name.toLowerCase() === name.toLowerCase()) nameExists = true;
    });
    if (nameExists) {
      return callback({ success: false, error: 'Name already taken' });
    }

    session.participants.set(socket.id, {
      name,
      joinedAt: Date.now(),
    });
    session.leaderboard.set(socket.id, 0);
    socket.join(sessionCode);

    const participantsList = Array.from(session.participants.entries()).map(([id, p]) => ({
      id,
      name: p.name,
    }));

    // Notify host
    io.to(session.hostSocketId).emit('game:participantJoined', {
      id: socket.id,
      name,
      participants: participantsList,
    });

    callback({ success: true, code: sessionCode, gameMode: session.gameMode });
  });

  socket.on('student:answer', ({ code, answer }) => {
    const session = sessions.get(code);
    if (!session || !session.isActive) return;

    const qi = session.currentQuestionIndex;
    if (qi < 0 || qi >= session.questions.length) return;

    const question = session.questions[qi];
    const answerKey = `${socket.id}_${qi}`;
    
    // Prevent duplicate answers
    if (session.answers.has(answerKey)) return;

    const answerTime = Date.now() - session.currentQuestionStartTime;
    
    // Check correctness
    let isCorrect = false;
    if (question.type === 'mcq' || question.type === 'rapid') {
      isCorrect = answer.toString().toLowerCase().trim() === question.correctAnswer.toString().toLowerCase().trim();
    } else {
      // Open answer – case insensitive match
      isCorrect = answer.toString().toLowerCase().trim() === question.correctAnswer.toString().toLowerCase().trim();
    }

    const score = getScoreForAnswer(isCorrect, answerTime, question.timeLimit);
    session.answers.set(answerKey, {
      playerId: socket.id,
      answer,
      isCorrect,
      answerTime,
      score,
    });

    // Update leaderboard
    const currentScore = session.leaderboard.get(socket.id) || 0;
    session.leaderboard.set(socket.id, currentScore + score);

    const participant = session.participants.get(socket.id);

    // Rapid fire: first correct wins
    if (session.gameMode === 'rapid' && isCorrect && !session.rapidFireWinner) {
      session.rapidFireWinner = socket.id;
      io.to(code).emit('game:rapidFireWinner', {
        id: socket.id,
        name: participant?.name,
        answerTime,
      });
    }

    // Send feedback to student
    socket.emit('student:answerResult', {
      isCorrect,
      score,
      totalScore: session.leaderboard.get(socket.id),
      correctAnswer: question.correctAnswer,
    });

    // Notify host of the answer
    io.to(session.hostSocketId).emit('host:answerReceived', {
      playerId: socket.id,
      playerName: participant?.name || 'Unknown',
      answer,
      isCorrect,
      answerTime,
      score,
      totalAnswers: session.answers.size,
      totalParticipants: session.participants.size,
    });

    // Check if all have answered
    const answeredCount = Array.from(session.answers.keys())
      .filter(k => k.endsWith(`_${qi}`)).length;

    if (answeredCount >= session.participants.size) {
      const boardSnapshot = [];
      session.leaderboard.forEach((s, playerId) => {
        const p = session.participants.get(playerId);
        if (p) boardSnapshot.push({ id: playerId, name: p.name, score: s });
      });
      boardSnapshot.sort((a, b) => b.score - a.score);
      io.to(code).emit('game:allAnswered', { leaderboard: boardSnapshot, correctAnswer: question.correctAnswer });
    }
  });

  // ── Disconnect ──

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    // Remove from any session
    sessions.forEach((session, code) => {
      if (session.hostSocketId === socket.id) {
        // Host disconnected – end session
        io.to(code).emit('game:hostDisconnected');
        sessions.delete(code);
      } else if (session.participants.has(socket.id)) {
        session.participants.delete(socket.id);
        const participantsList = Array.from(session.participants.entries()).map(([id, p]) => ({
          id,
          name: p.name,
        }));
        io.to(code).emit('game:participantLeft', {
          id: socket.id,
          participants: participantsList,
        });
      }
    });
  });
});

// ─── Start Server ───────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
