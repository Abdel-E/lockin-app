import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { io } from 'socket.io-client';
import { storage } from '../utils/storage';

const HEARTBEAT_INTERVAL = 5000;
const GRACE_PERIOD = 10000;

export function useSession() {
  const [currentSession, setCurrentSession] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);
  const [syncServerUrl, setSyncServerUrl] = useState(null);
  
  const socketRef = useRef(null);
  const heartbeatRef = useRef(null);
  const graceTimerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const isActiveRef = useRef(true);

  // Load user ID and sync server
  useEffect(() => {
    const init = async () => {
      const id = await storage.getUserId();
      setUserId(id);
      
      const serverUrl = await storage.getSyncServer();
      if (serverUrl) {
        setSyncServerUrl(serverUrl);
      }
    };
    init();
  }, []);

  // Initialize socket connection
  useEffect(() => {
    if (!syncServerUrl || !userId) return;

    const socket = io(syncServerUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Connected to sync server');
      setIsConnected(true);
      setError(null);
      
      socket.emit('presence:join', {
        userId,
        device: 'mobile'
      });
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from sync server');
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setError('Failed to connect to sync server');
    });

    socket.on('session:started', (session) => {
      console.log('🚀 Session started:', session);
      setCurrentSession(session);
    });

    socket.on('session:stopped', async (session) => {
      console.log('⏹️ Session stopped:', session);
      setCurrentSession(null);
      
      // Save session
      const sessions = await storage.getSessions();
      sessions.push(session);
      await storage.saveSessions(sessions);
      
      // Update task hours
      await updateTaskHours(session);
      
      // Stop heartbeat
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    });

    socket.on('session:rejected', (data) => {
      console.log('❌ Session rejected:', data);
      setError(`Session already active on ${data.activeDevice}`);
      setTimeout(() => setError(null), 5000);
    });

    socket.on('sync:state', (data) => {
      if (data.session) {
        setCurrentSession(data.session);
      }
    });

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
      socket.disconnect();
    };
  }, [syncServerUrl, userId]);

  // AppState change detection
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/active/) &&
        nextAppState.match(/inactive|background/)
      ) {
        // App went to background
        isActiveRef.current = false;
        console.log('⚠️ App backgrounded - starting grace period');
        
        // Start grace period
        graceTimerRef.current = setTimeout(() => {
          if (!isActiveRef.current && currentSession) {
            console.log('⏱️ Grace period expired, ending session');
            stopSession('backgrounded');
          }
        }, GRACE_PERIOD);
      } else if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground
        isActiveRef.current = true;
        console.log('✅ App active - canceling grace period');
        
        // Clear grace period
        if (graceTimerRef.current) {
          clearTimeout(graceTimerRef.current);
          graceTimerRef.current = null;
        }
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [currentSession]);

  // Heartbeat
  useEffect(() => {
    if (currentSession && socketRef.current && userId) {
      heartbeatRef.current = setInterval(() => {
        socketRef.current.emit('session:heartbeat', { userId });
        console.log('💓 Heartbeat sent');
      }, HEARTBEAT_INTERVAL);

      return () => {
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
        }
      };
    }
  }, [currentSession, userId]);

  const startSession = useCallback((taskId) => {
    if (!socketRef.current || !isConnected || !userId) {
      setError('Not connected to sync server');
      return;
    }

    socketRef.current.emit('session:start', {
      userId,
      taskId,
      device: 'mobile'
    });
  }, [isConnected, userId]);

  const stopSession = useCallback((reason = 'user') => {
    if (!socketRef.current || !userId) return;

    socketRef.current.emit('session:stop', {
      userId,
      reason
    });
  }, [userId]);

  const setSyncServer = useCallback(async (url) => {
    await storage.setSyncServer(url);
    setSyncServerUrl(url);
  }, []);

  return {
    currentSession,
    isConnected,
    error,
    startSession,
    stopSession,
    userId,
    syncServerUrl,
    setSyncServer
  };
}

async function updateTaskHours(session) {
  const tasks = await storage.getTasks();
  const task = tasks.find(t => t.id === session.taskId);
  
  if (task) {
    const hoursCompleted = session.elapsedMins / 60;
    task.hoursRemaining = Math.max(0, task.hoursRemaining - hoursCompleted);
    await storage.saveTasks(tasks);
    
    // Update daily stats
    const today = new Date().toISOString().split('T')[0];
    const dailyStats = await storage.getDailyStats(today);
    dailyStats.hoursCompleted += hoursCompleted;
    dailyStats.sessionCount += 1;
    await storage.saveDailyStats(today, dailyStats);
  }
}
