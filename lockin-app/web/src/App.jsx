import { Suspense, lazy, useMemo, useEffect, useState } from 'react';
import { storage } from './utils/storage';
import { initializeSeedData } from './utils/seedData';
import { TaskList } from './components/TaskList';
import { Calendar } from './components/Calendar';
import OnboardingModal from './components/OnboardingModal';
import { Jarvis } from './components/Jarvis';
import './index.css';
import SetupModal from './components/SetupModal';

const GC_ENABLED = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GoogleConnect = GC_ENABLED ? lazy(() => import('./components/GoogleConnect')) : null;

function App() {
  const [currentSession, setCurrentSession] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('lockin_theme') === 'dark');
  const [error, setError] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [, setTick] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(() => !storage.getPreferences());
  const [planVersion, setPlanVersion] = useState(0);

  useEffect(() => {
    initializeSeedData(storage);
    const sessions = storage.getSessions();
    const activeSession = sessions.find((s) => !s.endTime);
    if (activeSession) setCurrentSession(activeSession);

    // one-time migration: mark schedule-sourced blocks as class
    const plans = storage.getPlans?.() ?? [];
    const updated = plans.map(p => (p.source === 'schedule' && p.type !== 'class') ? { ...p, type: 'class' } : p);
    if (updated.some((p, i) => p !== plans[i])) {
      storage.setPlans?.(updated);
      setPlanVersion(v => v + 1);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('lockin_theme', isDarkMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // live ticking when a session is active
  useEffect(() => {
    if (!currentSession) return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [currentSession]);

  const startSession = (taskId) => {
    try {
      const id = taskId || selectedTaskId;
      const task = storage.getTasks().find((t) => t.id === id);
      if (!task) return setError('Select a task to lock in.');
      const session = {
        id: Date.now().toString(),
        taskId: id,
        startTime: new Date().toISOString(),
        endTime: null,
        duration: 0,
        endReason: null,
      };
      storage.addSession(session);
      setCurrentSession(session);
      setError(null);
    } catch (err) {
      setError('Failed to start session: ' + err.message);
    }
  };

  const stopSession = (reason) => {
    if (!currentSession) return;
    try {
      const endTime = new Date().toISOString();
      const duration = new Date(endTime) - new Date(currentSession.startTime);
      const updated = { ...currentSession, endTime, duration, endReason: reason };
      storage.updateSession(updated);

      // apply time to task remaining
      const task = storage.getTasks().find((t) => t.id === currentSession.taskId);
      if (task) {
        const hoursSpent = duration / 36e5;
        storage.updateTask(
          task.id,
          task.name,
          Math.max(0, (task.hoursRemaining ?? 0) - hoursSpent),
          { subject: task.subject, dueDate: task.dueDate, estimateHours: task.estimateHours }
        );
      }

      setCurrentSession(null);
      setError(null);
    } catch (err) {
      setError('Failed to stop session: ' + err.message);
    }
  };

  const toggleDarkMode = () => setIsDarkMode((p) => !p);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dailyStats = storage.getDailyStats(todayStr);
  const elapsedMs = currentSession ? Date.now() - new Date(currentSession.startTime).getTime() : 0;
  const hoursCompletedToday = (dailyStats.totalTime + elapsedMs) / 36e5;

  // Target = sum of hoursRemaining for tasks due today; fallback to 6h if none
  const tasksToday = storage.getTasks().filter((t) => t.dueDate === todayStr);
  const targetHoursToday = tasksToday.length
    ? tasksToday.reduce((s, t) => s + Math.max(0, t.hoursRemaining ?? 0), 0)
    : 6;

  const getProgressPercentage = () => {
    if (targetHoursToday <= 0) return 0;
    return Math.min((hoursCompletedToday / targetHoursToday) * 100, 100);
  };
  const getProgressStatus = () => {
    const pct = getProgressPercentage();
    if (pct < 33) return 'Cooked';
    if (pct < 66) return 'Warming Up';
    return 'Locked In';
  };
  const getBaseFillColor = () => {
    const s = getProgressStatus();
    if (s === 'Cooked') return 'bg-red-500';
    if (s === 'Warming Up') return 'bg-amber-400';
    return 'bg-emerald-500';
  };

  const week = storage.getWeekStats(new Date());
  const weekPct = Math.round((week.totalTime / 36e5) / week.targetHours * 100);

  const formatHMS = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  const clearCalendar = () => {
    if (!window.confirm('Clear all calendar blocks? Tasks will be kept.')) return;
    storage.clearPlans?.() ?? storage.setPlans([]);
    setPlanVersion(v => v + 1);
  };

  const weekStart = useMemo(() => {
    const d = new Date(); d.setHours(0,0,0,0);
    const offset = (d.getDay() + 1) % 7; // Sat as first day
    d.setDate(d.getDate() - offset);
    return d;
  }, []);

  return (
    <div className={`${isDarkMode ? 'bg-[#0f1011]' : 'bg-[#efe8e1]'} transition-colors overflow-x-hidden`}>
      {/* Onboarding modal */}
      <OnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} />

      {/* Header */}
      <header className={`${isDarkMode ? 'bg-[#0f1011]' : 'bg-[#efe8e1]'} sticky top-0 z-20`}>
        <div className="max-w-[1400px] mx-auto px-5 pt-5 pb-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <h1 className={`font-serifTitle text-3xl ${isDarkMode ? 'text-white' : 'text-[#1d1d1d]'}`}>TheGreatLockIn</h1>

            {/* Big live session timer in center */}
            <div className="justify-self-center">
              {currentSession ? (
                <div className={`font-serifTitle text-4xl ${isDarkMode ? 'text-white' : 'text-[#1d1d1d]'}`}>
                  {formatHMS(elapsedMs)}
                </div>
              ) : null}
            </div>

            <div className="justify-self-end flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${isDarkMode ? 'bg-[#1a1b1d] text-gray-200' : 'bg-[#e1d8cf] text-[#3b312a]'} border ${isDarkMode ? 'border-[#2a2c2f]' : 'border-[#d0c5ba]'}`}
                title="Week completion toward target hours"
              >
                Week: {Math.max(0, Math.min(weekPct, 100))}%
              </span>
              <button
                onClick={toggleDarkMode}
                className={`text-sm px-3 py-2 rounded-full ${isDarkMode ? 'bg-[#1a1b1d] text-gray-100' : 'bg-[#e1d8cf] text-[#2e2e2e]'} border ${isDarkMode ? 'border-[#2a2c2f]' : 'border-[#d0c5ba]'}`}
                title="Toggle theme"
              >
                {isDarkMode ? '☀︎' : '☾'}
              </button>
            </div>
          </div>

          {/* Top full-width progress bar */}
          <div className="mt-3 flex items-center gap-3">
            <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-[#54473f]'}`}>Cooked</span>
            <div className="relative flex-1 h-5 rounded-full overflow-hidden bg-black/15">
              {/* solid fill (no gradient on the left) */}
              <div
                className={`absolute inset-y-0 left-0 ${getBaseFillColor()} transition-all`}
                style={{ width: `${getProgressPercentage()}%` }}
              />
              {/* right-edge gradient glow only inside the filled area */}
              <div
                className="absolute inset-y-0 left-0 overflow-hidden pointer-events-none"
                style={{ width: `${getProgressPercentage()}%` }}
              >
                <div
                  className={`absolute inset-y-0 right-0 w-24 bg-gradient-to-r ${
                    isDarkMode ? 'from-transparent to-white/10' : 'from-transparent to-white/40'
                  }`}
                />
              </div>
            </div>
            <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-[#54473f]'}`}>Locked In</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-[1400px] mx-auto px-5 pb-8">
        <div className="grid grid-cols-1 xl:grid-cols-[7fr_5fr] gap-6 items-start">
          {/* Calendar */}
          <section className={`${isDarkMode ? 'bg-[#141517] border-[#2a2c2f]' : 'bg-[#d9cec3] border-[#cbbfb2]'} border rounded-2xl p-5 overflow-hidden`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className={`font-serifTitle ${isDarkMode ? 'text-white' : 'text-[#3b312a]'}`}>Calendar</h2>
              <div className="flex items-center gap-3">
                {GC_ENABLED ? (
                  <Suspense fallback={null}>
                    <GoogleConnect weekStart={weekStart} isDarkMode={isDarkMode} />
                  </Suspense>
                ) : (
                  <span className="text-xs opacity-70">Google sync off</span>
                )}
                {/* Upload button removed; schedule import is now in Setup */}
                <button
                  onClick={clearCalendar}
                  className={`text-xs px-3 py-1 rounded-full border ${
                    isDarkMode ? 'bg-[#1b1d1f] text-gray-100 border-[#2a2c2f]' : 'bg-[#e1d8cf] text-[#2e2e2e] border-[#cbbfb2]'
                  }`}
                  title="Remove all calendar blocks"
                >
                  Clear
                </button>
              </div>
            </div>
            <Calendar
              key={planVersion}
              isDarkMode={isDarkMode}
              activeTaskId={currentSession?.taskId || null}
              activeElapsedMs={currentSession ? Date.now() - new Date(currentSession.startTime).getTime() : 0}
            />
          </section>

          {/* Right column */}
          <div className="flex flex-col gap-6">
            {/* Jarvis section with Setup button */}
            <section className={`${isDarkMode ? 'bg-[#141517] border-[#2a2c2f]' : 'bg-[#d9cec3] border-[#cbbfb2]'} border rounded-2xl p-5 overflow-hidden`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className={`font-serifTitle ${isDarkMode ? 'text-white' : 'text-[#3b312a]'}`}>Jarvis</h2>
                <button
                  onClick={() => setShowOnboarding(true)}
                  className="text-xs px-3 py-1 rounded-full bg-[#2b2f31] text-white border border-[#3a3f43]"
                >
                  Setup
                </button>
              </div>
              <Jarvis
                isDarkMode={isDarkMode}
                weekStart={weekStart}
                onClassesImported={() => setPlanVersion((v) => v + 1)}
              />
            </section>

            {/* To-do section unchanged */}
            <section className={`${isDarkMode ? 'bg-[#141517] border-[#2a2c2f]' : 'bg-[#d9cec3] border-[#cbbfb2]'} border rounded-2xl p-5 overflow-hidden`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className={`font-serifTitle ${isDarkMode ? 'text-white' : 'text-[#3b312a]'}`}>To-do List</h2>

                {/* Single Lock button on top-right */}
                {currentSession ? (
                  <button
                    onClick={() => stopSession('user')}
                    className={`${isDarkMode ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'} rounded-full px-5 py-2 text-sm`}
                  >
                    Lock Out
                  </button>
                ) : (
                  <button
                    onClick={() => startSession(selectedTaskId)}
                    disabled={!selectedTaskId}
                    className={`rounded-full px-5 py-2 text-sm ${selectedTaskId ? (isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white') : 'bg-gray-400 text-white cursor-not-allowed'}`}
                  >
                    Lock In
                  </button>
                )}
              </div>

              <TaskList
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
                currentSession={currentSession}
                isSessionActive={!!currentSession}
                isDarkMode={isDarkMode}
              />
            </section>
          </div>
        </div>
      </main>

      {/* Setup modal (includes Class Schedule import) */}
      <SetupModal
        open={showOnboarding}
        isDarkMode={isDarkMode}
        weekStart={weekStart}
        onImported={() => setPlanVersion(v => v + 1)}
        onClose={() => setShowOnboarding(false)}
      />

      {/* error */}
      {error && <div className="fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">⚠️ {error}</div>}
    </div>
  );
}

export default App;