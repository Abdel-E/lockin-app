import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// In-memory session store
const sessions = new Map();
const heartbeatTimers = new Map();

const HEARTBEAT_TTL = 15000; // 15 seconds

// Helper to end session
function endSession(userId, reason = 'timeout') {
  const session = sessions.get(userId);
  if (!session) return;

  const endedAt = new Date().toISOString();
  const startedAt = new Date(session.startedAt);
  const elapsedMins = Math.floor((new Date(endedAt) - startedAt) / 1000 / 60);

  const endedSession = {
    ...session,
    endedAt,
    elapsedMins,
    status: 'completed',
    reason
  };

  sessions.set(userId, endedSession);
  io.to(`user:${userId}`).emit('session:stopped', endedSession);

  // Clear heartbeat timer
  if (heartbeatTimers.has(userId)) {
    clearTimeout(heartbeatTimers.get(userId));
    heartbeatTimers.delete(userId);
  }

  console.log(`Session ended for user ${userId} - reason: ${reason}, elapsed: ${elapsedMins}m`);
}

// Reset heartbeat timer
function resetHeartbeatTimer(userId) {
  if (heartbeatTimers.has(userId)) {
    clearTimeout(heartbeatTimers.get(userId));
  }

  const timer = setTimeout(() => {
    console.log(`Heartbeat timeout for user ${userId}`);
    endSession(userId, 'timeout');
  }, HEARTBEAT_TTL);

  heartbeatTimers.set(userId, timer);
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('presence:join', ({ userId, device }) => {
    socket.join(`user:${userId}`);
    socket.userId = userId;
    socket.device = device;
    console.log(`${device} joined room for user ${userId}`);

    // Send current session state if exists
    const currentSession = sessions.get(userId);
    if (currentSession && currentSession.status === 'active') {
      socket.emit('sync:state', { session: currentSession });
    }
  });

  socket.on('session:start', (payload) => {
    const { userId, taskId, device } = payload;
    const existingSession = sessions.get(userId);

    // Check if session already active
    if (existingSession && existingSession.status === 'active') {
      socket.emit('session:rejected', {
        reason: 'Session already active',
        activeDevice: existingSession.device
      });
      return;
    }

    const session = {
      id: `sess_${Date.now()}`,
      taskId,
      userId,
      startedAt: new Date().toISOString(),
      device,
      status: 'active',
      elapsedMins: 0,
      lastHeartbeat: new Date().toISOString()
    };

    sessions.set(userId, session);
    io.to(`user:${userId}`).emit('session:started', session);
    
    // Start heartbeat timer
    resetHeartbeatTimer(userId);

    console.log(`Session started for user ${userId} on ${device}`);
  });

  socket.on('session:heartbeat', ({ userId }) => {
    const session = sessions.get(userId);
    if (session && session.status === 'active') {
      session.lastHeartbeat = new Date().toISOString();
      resetHeartbeatTimer(userId);
    }
  });

  socket.on('session:stop', ({ userId, reason = 'user' }) => {
    endSession(userId, reason);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (socket.userId) {
      console.log(`Client disconnected but TTL will handle session end if no reconnect`);
    }
  });
});

// REST endpoints
app.get('/status/:userId', (req, res) => {
  const { userId } = req.params;
  const session = sessions.get(userId);
  
  res.json({
    active: session?.status === 'active',
    session: session || null
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    activeSessions: Array.from(sessions.values()).filter(s => s.status === 'active').length,
    totalSessions: sessions.size
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Sync server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});
