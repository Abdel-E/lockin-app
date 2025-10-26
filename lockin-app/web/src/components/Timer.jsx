import { useState, useEffect } from 'react';
import { storage } from '../utils/storage';

export function Timer({ session, onStop }) {
  const [elapsed, setElapsed] = useState(0);
  const [task, setTask] = useState(null);

  useEffect(() => {
    if (!session) return;

    // Load task info
    const tasks = storage.getTasks();
    const currentTask = tasks.find(t => t.id === session.taskId);
    setTask(currentTask);

    // Update elapsed time every second
    const interval = setInterval(() => {
      const start = new Date(session.startedAt);
      const now = new Date();
      const elapsedSeconds = Math.floor((now - start) / 1000);
      setElapsed(elapsedSeconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  if (!session || !task) return null;

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border-4 border-blue-500">
        <div className="text-center space-y-6">
          {/* Status indicator */}
          <div className="flex items-center justify-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-gray-600">Session Active on {session.device}</span>
          </div>

          {/* Timer */}
          <div>
            <div className="text-7xl font-mono font-bold text-gray-900 mb-2 tracking-tight">
              {formattedTime}
            </div>
            <div className="text-sm text-gray-500">
              {Math.floor(elapsed / 60)} minutes elapsed
            </div>
          </div>

          {/* Task info */}
          <div className="py-4 border-y border-gray-200">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Working on</p>
            <p className="text-2xl font-semibold text-gray-900">{task.title}</p>
            <p className="text-sm text-gray-600 mt-1 flex items-center justify-center gap-2">
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                {task.course}
              </span>
              <span className="text-gray-400">•</span>
              <span>{task.hoursRemaining.toFixed(1)}h remaining</span>
            </p>
          </div>

          {/* Lock Out button */}
          <button
            onClick={onStop}
            className="w-full px-6 py-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold text-lg shadow-lg hover:shadow-xl"
          >
            🔓 Lock Out
          </button>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-xs text-yellow-800">
              ⚠️ Session will auto-end if you switch tabs or close the app for more than 10 seconds
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
