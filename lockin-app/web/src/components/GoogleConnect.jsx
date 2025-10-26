import { useMemo } from 'react';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { useCalendarSync } from '../hooks/useCalendarSync';

export default function GoogleConnect({ weekStart, isDarkMode }) {
  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
    return <span className="text-xs opacity-70">Google sync off</span>;
  }
  const { isAuthed, ensureToken, signOut } = useGoogleAuth();
  const { status, syncWeek, pushPending, pullWeek } = useCalendarSync();
  const btn = useMemo(() =>
    `text-xs px-3 py-1 rounded-full border ${isDarkMode ? 'bg-[#1b1d1f] text-gray-100 border-[#2a2c2f]' : 'bg-[#e1d8cf] text-[#2e2e2e] border-[#cbbfb2]'}`
  , [isDarkMode]);

  return (
    <div className="flex items-center gap-2">
      {!isAuthed ? (
        <button className={btn} onClick={() => ensureToken()}>Connect Google</button>
      ) : (
        <>
          <button className={btn} onClick={() => syncWeek(weekStart)}>Sync week</button>
          <button className={btn} onClick={() => pushPending()}>Push</button>
          <button className={btn} onClick={() => pullWeek(weekStart)}>Pull</button>
          <button className={btn} onClick={signOut}>Disconnect</button>
          {status && <span className="text-xs opacity-70 ml-2">{status}</span>}
        </>
      )}
    </div>
  );
}