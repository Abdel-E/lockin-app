import { useEffect, useMemo, useRef, useState } from 'react';
import { storage } from '../utils/storage';

const HOUR_HEIGHT = 88;
const GAP = 12;
const GUTTER = 76;
const RIGHT_PAD = 12;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function Calendar({ isDarkMode, activeTaskId = null, activeElapsedMs = 0 }) {
  const [active, setActive] = useState(0);            // index into rolling 7 days
  const [viewMode, setViewMode] = useState('week');   // 'week' | 'day'
  const [startDate] = useState(() => startOfToday());
  const [plans, setPlans] = useState(() => storage.getPlans());

  const dates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [startDate]
  );
  const visibleDates = useMemo(
    () => (viewMode === 'week' ? dates : [dates[active]]),
    [viewMode, dates, active]
  );
  const colCount = visibleDates.length;

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const now = new Date();
    const y = (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT;
    el.scrollTop = Math.max(0, y - 160);
  }, []);

  useEffect(() => {
    const i = setInterval(() => setPlans(storage.getPlans()), 1000);
    return () => clearInterval(i);
  }, []);
  // Also refresh immediately when storage broadcasts a change
  useEffect(() => {
    const onPlans = () => setPlans(storage.getPlans());
    window.addEventListener('lockin:plans', onPlans);
    return () => window.removeEventListener('lockin:plans', onPlans);
  }, []);

  const nowOffset = () => {
    const n = new Date();
    return (n.getHours() + n.getMinutes() / 60) * HOUR_HEIGHT;
  };

  // Position block within the visible grid (week or single day)
  const planStyle = (startISO, durationMs) => {
    const dt = new Date(startISO);

    const dayStart = new Date(startDate); dayStart.setHours(0, 0, 0, 0);
    const eventDay = new Date(dt); eventDay.setHours(0, 0, 0, 0);

    const dayIdx = Math.floor((eventDay - dayStart) / 86_400_000); // 0..6
    if (dayIdx < 0 || dayIdx > 6) return null;
    // Map to visible column index
    const colIdx = viewMode === 'week' ? dayIdx : 0;

    const top = (dt.getHours() + dt.getMinutes() / 60) * HOUR_HEIGHT;
    const height = Math.max(22, (durationMs / 36e5) * HOUR_HEIGHT);

    const colExpr = `(100% - ${GUTTER}px - ${RIGHT_PAD}px - ${GAP}px * ${colCount - 1}) / ${colCount}`;
    const left = `calc(${GUTTER}px + ((${colExpr}) + ${GAP}px) * ${colIdx})`;
    const width = `calc(${colExpr})`;

    return { top: `${top}px`, height: `${height}px`, left, width };
  };

  return (
    <div className="space-y-3">
      {/* Header with date pills and Week view toggle */}
      <div className="flex items-center justify-between pl-[76px] pr-3">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0,1fr))` }}>
          {visibleDates.map((d, i) => {
            // map visible index back to absolute index in dates[]
            const absIdx = viewMode === 'week' ? i : active;
            return (
              <button
                key={`${d.toDateString()}_${i}`}
                onClick={() => { setActive(absIdx); setViewMode('day'); }}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  isDarkMode
                    ? absIdx === active
                      ? 'bg-[#2b2f31] text-white'
                      : 'bg-[#1a1b1d] text-gray-300'
                    : absIdx === active
                    ? 'bg-[#c4b7a9] text-[#2d2925]'
                    : 'bg-[#e6ddd3] text-[#4e433b]'
                }`}
              >
                {d.toLocaleDateString([], { weekday: 'short' })}{' '}
                <span className="opacity-70">
                  {String(d.getMonth() + 1)}/{d.getDate()}
                </span>
              </button>
            );
          })}
        </div>
        {viewMode === 'day' && (
          <button
            onClick={() => setViewMode('week')}
            className={`text-xs px-3 py-1 rounded-full border ${
              isDarkMode ? 'bg-[#1b1d1f] text-gray-100 border-[#2a2c2f]' : 'bg-[#e1d8cf] text-[#2e2e2e] border-[#cbbfb2]'
            }`}
          >
            Week view
          </button>
        )}
      </div>

      {/* Fixed height, vertical scroll only */}
      <div
        ref={scrollRef}
        className={`relative h-[620px] overflow-y-auto overflow-x-hidden rounded-xl scroll-area ${
          isDarkMode ? 'bg-[#1b1d1f]' : 'bg-[#e8e3de]'
        }`}
      >
        <div className="relative" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
          {hours.map((h) => {
            const label = new Date(2000, 0, 1, h)
              .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              .toLowerCase();
            return (
              <div
                key={h}
                className="absolute left-0 right-0"
                style={{ top: `${h * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
              >
                <div className="flex h-full">
                  <div className={`w-[76px] pl-2 pr-3 text-[11px] tracking-wide flex items-start pt-2 select-none ${isDarkMode ? 'text-white opacity-90' : 'text-[#54473f] opacity-80'}`}>
                    {label}
                  </div>
                  {/* columns match visibleDates */}
                  <div className="flex-1 grid gap-3 pr-3" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0,1fr))` }}>
                    {visibleDates.map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-full rounded-md border ${
                          isDarkMode
                            ? 'border-[#2a2c2f] bg-[#222426]'
                            : 'border-[#d7c9bc] bg-[#ebe8e5]'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Current time line */}
          <div className="absolute left-[76px] right-3" style={{ top: `${nowOffset()}px` }}>
            <div className="relative h-[2px] bg-red-500/70">
              <div className="absolute -left-2 -top-[5px] w-3.5 h-3.5 rounded-full bg-red-500" />
            </div>
          </div>

          {/* Planned blocks */}
          <div className="absolute inset-0 pointer-events-none">
            {plans
              .filter((p) => {
                const dt = new Date(p.startTime);
                const windowStart = new Date(startDate); windowStart.setHours(0,0,0,0);
                if (viewMode === 'day') {
                  const d = new Date(dates[active]); d.setHours(0,0,0,0);
                  const next = new Date(d); next.setDate(next.getDate() + 1);
                  return dt >= d && dt < next;
                }
                const end = new Date(windowStart); end.setDate(end.getDate() + 7);
                return dt >= windowStart && dt < end;
              })
              .map((p) => {
                const style = planStyle(p.startTime, p.duration);
                if (!style) return null;
                const isActive = activeTaskId && p.taskId === activeTaskId;
                const pct = isActive ? Math.min(activeElapsedMs / p.duration, 1) : 0;
                return (
                  <div
                    key={p.id}
                    className={`absolute rounded-md shadow-sm overflow-hidden ${
                      isDarkMode
                        ? 'border border-[#2a2c2f] text-gray-100'
                        : 'border border-[#cbbfb2] text-[#2e2e2e]'
                    }`}
                    style={{
                      ...style,
                      background: isDarkMode
                        ? 'rgba(125, 211, 252, 0.15)'
                        : 'rgba(125, 211, 252, 0.3)',
                    }}
                  >
                    {isActive && (
                      <div
                        className="absolute left-0 right-0 bottom-0 bg-emerald-500/40"
                        style={{ height: `${pct * 100}%` }}
                      />
                    )}
                    <div className="relative px-2 py-1 text-[11px] leading-4">
                      <div className="font-medium truncate">{p.title}</div>
                      <div className="opacity-70 truncate">
                        {new Date(p.startTime)
                          .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          .toLowerCase()}{' '}
                        · {(p.duration / 36e5).toFixed(1)}h
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}