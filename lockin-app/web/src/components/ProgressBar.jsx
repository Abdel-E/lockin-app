import { useState, useEffect } from 'react';
import { storage } from '../utils/storage';

export function ProgressBar() {
  const [dailyProgress, setDailyProgress] = useState(0);
  const [weeklyProgress, setWeeklyProgress] = useState(0);
  const [dailyTarget, setDailyTarget] = useState(3);
  const [weeklyTarget, setWeeklyTarget] = useState(12);

  useEffect(() => {
    updateProgress();
    
    // Update every few seconds
    const interval = setInterval(updateProgress, 3000);
    return () => clearInterval(interval);
  }, []);

  const updateProgress = () => {
    const profile = storage.getProfile();
    if (profile) {
      setDailyTarget(profile.studyPrefs.dailyTargetHours);
      setWeeklyTarget(profile.studyPrefs.weeklyTargetHours);
    }

    // Calculate daily progress
    const today = new Date().toISOString().split('T')[0];
    const dailyStats = storage.getDailyStats(today);
    setDailyProgress(dailyStats.hoursCompleted);

    // Calculate weekly progress
    const sessions = storage.getSessions();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklySessions = sessions.filter(s => new Date(s.startedAt) > weekAgo);
    const weeklyHours = weeklySessions.reduce((sum, s) => sum + (s.elapsedMins / 60), 0);
    setWeeklyProgress(weeklyHours);
  };

  const dailyPercentage = (dailyProgress / dailyTarget) * 100;
  const weeklyPercentage = (weeklyProgress / weeklyTarget) * 100;

  const getDailyColor = () => {
    if (dailyPercentage >= 67) return 'bg-green-500';
    if (dailyPercentage >= 34) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getWeeklyColor = () => {
    if (weeklyPercentage >= 67) return 'bg-green-500';
    if (weeklyPercentage >= 34) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
      {/* Daily Progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-lg">📊 Daily Progress</h3>
          <span className="text-sm font-medium text-gray-600">
            {dailyProgress.toFixed(1)}h / {dailyTarget}h
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
          <div
            className={`${getDailyColor()} h-4 rounded-full transition-all duration-500`}
            style={{ width: `${Math.min(dailyPercentage, 100)}%` }}
          />
        </div>
        
        <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
          <span>🔴 0-33%</span>
          <span>🟡 34-66%</span>
          <span>🟢 67-100%</span>
        </div>

        {dailyPercentage >= 100 && (
          <p className="text-sm text-green-600 font-medium mt-2 flex items-center gap-1">
            🎉 Daily goal achieved! Great work!
          </p>
        )}
      </div>

      {/* Weekly Progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">📅 Weekly Progress</h3>
          <span className="text-sm text-gray-600">
            {weeklyProgress.toFixed(1)}h / {weeklyTarget}h
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`${getWeeklyColor()} h-3 rounded-full transition-all duration-500`}
            style={{ width: `${Math.min(weeklyPercentage, 100)}%` }}
          />
        </div>

        {weeklyPercentage >= 100 && (
          <p className="text-xs text-green-600 font-medium mt-1">
            ✅ Weekly goal complete!
          </p>
        )}
      </div>
    </div>
  );
}
