import { useEffect, useState } from 'react';
import { useGemini } from '../hooks/useGemini';
import { storage } from '../utils/storage';
import { parseWeeklyScheduleImage } from '../utils/scheduleParser';

export default function OnboardingModal({ open, onClose }) {
  const { ready, planFromScreenshot, loading, error } = useGemini();
  const [submitting, setSubmitting] = useState(false);
  const [scheduleFile, setScheduleFile] = useState(null);
  const [upcoming, setUpcoming] = useState('');
  const [courseRank, setCourseRank] = useState('');
  const [maxStudyPerDay, setMaxStudyPerDay] = useState(4);
  const [latestStudyEnd, setLatestStudyEnd] = useState('20:00');
  const [commitments, setCommitments] = useState('');
  const [hobbyHours, setHobbyHours] = useState(5);
  const [studyStyle, setStudyStyle] = useState('Focused 50m blocks with 10m breaks');

  useEffect(() => {
    if (!open) return;
    const p = storage.getPreferences();
    if (p) {
      setMaxStudyPerDay(p.maxStudyPerDay ?? 4);
      setLatestStudyEnd(p.latestStudyEnd ?? '20:00');
      setHobbyHours(p.hobbyHours ?? 5);
      setStudyStyle(p.studyStyle ?? 'Focused 50m blocks with 10m breaks');
    }
  }, [open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    // mark submitting so the button shows 'Planning…' immediately
    setSubmitting(true);
    // yield so React can render the button state before heavy async work
    await new Promise((r) => setTimeout(r, 0));
    const prefs = {
      courseRank,
      maxStudyPerDay: Number(maxStudyPerDay) || 4,
      latestStudyEnd,
      commitments,
      hobbyHours: Number(hobbyHours) || 0,
      studyStyle,
    };
    storage.setPreferences(prefs);
    // If user provided a schedule screenshot, parse class meetings first and add them as schedule blocks.
    if (scheduleFile) {
      try {
        const classBlocks = await parseWeeklyScheduleImage(scheduleFile, { weekStartLocal: new Date() });
        for (const b of classBlocks) {
          storage.addPlanBlockFromSchedule?.({
            id: b.id,
            title: b.title,
            subtitle: b.subtitle,
            startMs: b.startMs,
            endMs: b.endMs,
            type: 'class',
            source: 'schedule',
          });
        }
      } catch (e) {
        console.error('Failed to parse schedule image for classes:', e);
      }
    }

    // If Gemini is available, use it. Otherwise fall back to a local planner.
    let result = { tasks: [], plans: [] };
    try {
      if (ready) {
        result = await planFromScreenshot({ file: scheduleFile, upcoming, prefs });
      } else {
        // Local fallback: create generic study blocks across next 7 days respecting prefs
        const fallbackPlans = [];
        const fallbackTasks = [];
        const maxPerDay = Number(prefs.maxStudyPerDay || 4);
        const durationPerBlockHours = 1.5; // default block length
        const now = new Date();
        for (let i = 0; i < 7; i++) {
          const day = new Date(now); day.setDate(now.getDate() + i); day.setHours(0,0,0,0);
          // pick an end time based on latestStudyEnd
          const [endH, endM] = String(prefs.latestStudyEnd || '20:00').split(':').map((n) => parseInt(n || '0', 10));
          let endDate = new Date(day); endDate.setHours(endH, endM || 0, 0, 0);
          // Make up to Math.ceil(maxPerDay / 2) blocks per day as a simple heuristic
          const blocksToday = Math.max(1, Math.min(2, Math.ceil(maxPerDay / 2)));
          for (let j = 0; j < blocksToday; j++) {
            // start earlier by j * (duration + 0.5h)
            const start = new Date(endDate.getTime() - (durationPerBlockHours * 36e5) - j * (durationPerBlockHours * 36e5 + 30 * 60_000));
            const p = {
              id: `plan_fallback_${day.toISOString().slice(0,10)}_${j}`,
              title: 'Study',
              subject: '',
              startTime: start.toISOString(),
              duration: Math.max(30 * 60_000, durationPerBlockHours * 36e5),
              color: '#7dd3fc',
            };
            fallbackPlans.push(p);
            // create or reuse a generic task for these study blocks
            const taskName = 'Study';
            let task = storage.findTaskByName(taskName);
            if (!task) task = storage.addTask(taskName, durationPerBlockHours, '', day.toISOString().slice(0,10), { skipUpsert: true });
            p.taskId = task.id;
            fallbackTasks.push({ name: taskName, estimateHours: durationPerBlockHours });
          }
        }
        result = { tasks: fallbackTasks, plans: fallbackPlans };
      }
    } catch (e) {
      console.error('Planning failed:', e);
      // show Gemini error if available (useGemini exposes `error`) - keep modal open
      setSubmitting(false);
      return;
    }

    // create tasks from result (these will upsert a plan for each task by default)
    const created = [];
    for (const t of result.tasks || []) {
      const task = storage.addTask(t.name, t.estimateHours || 1, t.subject || '', t.dueDate || null);
      created.push({ name: t.name.toLowerCase(), id: task.id });
    }
    const map = new Map(created.map((x) => [x.name, x.id]));

    // Refresh existing plans AFTER creating tasks so that any upserted plans
    // created by addTask are preserved when we later merge candidate plans.
    let existing = storage.getPlans() || [];
    const existingStudyHoursByDate = {};
    for (const ex of existing) {
      if (!ex || ex.source === 'schedule') continue; // only count study/task blocks
      const s = ex.startTime ? new Date(ex.startTime).toISOString().slice(0,10) : (ex.startMs ? new Date(ex.startMs).toISOString().slice(0,10) : null);
      if (!s) continue;
      existingStudyHoursByDate[s] = (existingStudyHoursByDate[s] || 0) + ((ex.duration || 0) / 36e5);
    }

    const maxPerDay = Number(prefs.maxStudyPerDay || 4);
    const candidatePlans = (result.plans || []).map((p, idx) => {
      if (p.startTime) return { ...p };
      const start = `${p.date}T${(p.start || '17:00')}:00`;
      const [sh, sm] = (p.start || '17:00').split(':').map((n) => parseInt(n || '0', 10));
      const [eh, em] = (p.end || '18:00').split(':').map((n) => parseInt(n || '0', 10));
      const duration = (eh * 60 + em - (sh * 60 + sm)) * 60_000;
      return {
        id: p.id || `plan_${Date.now()}_${idx}`,
        taskId: p.taskName ? map.get(p.taskName.toLowerCase()) || null : p.taskId || null,
        title: p.title || p.taskName || 'Study',
        subject: p.subject || '',
        startTime: new Date(start).toISOString(),
        duration: Math.max(duration || p.duration || 0, 30 * 60_000),
        color: '#7dd3fc',
      };
    });

    // If the user appears to have asked Gemini to add a single specific block
    // (heuristic: exactly one candidate plan and the "upcoming" text contains
    // a date/time or an explicit add/schedule verb), then add only that plan
    // instead of bulk-creating many study blocks.
    const looksLikeSingleAdd = (candidatePlans.length === 1) && /add|schedule|insert|create/i.test(String(upcoming || '')) && (/\d{4}-\d{2}-\d{2}|\b\d{1,2}:\d{2}\b/.test(String(upcoming || '')) || /today|tomorrow|mon|tue|wed|thu|fri|sat|sun/i.test(String(upcoming || '')));
    if (looksLikeSingleAdd) {
      const single = candidatePlans[0];
      // Ensure it is linked to a task if we created one above
      if (!single.taskId && single.title) {
        const tid = map.get((single.taskName || single.title || '').toLowerCase()) || null;
        if (tid) single.taskId = tid;
      }
      // Only add the single plan if it doesn't overlap existing calendar items
      const sMs = single.startTime ? new Date(single.startTime).getTime() : (single.startMs || 0);
      const eMs = sMs + (single.duration || 0);
      if (typeof storage.isRangeFree === 'function' && !storage.isRangeFree(sMs, eMs)) {
        // If occupied, do not add duplicate — just ensure task exists and upsert its plan
        if (single.taskId) {
          const task = storage.getTasks().find((t) => t.id === single.taskId);
          if (task) storage.upsertPlanForTask(task);
        }
      } else {
        // Merge with current plans (re-read to avoid stomping on other writers)
        const nowExisting = storage.getPlans() || [];
        storage.setPlans([...nowExisting, single]);
      }
      setSubmitting(false);
      onClose?.();
      return;
    }

    // Filter candidate plans to respect max study hours per day and avoid overlaps with existing plans
    const finalPlans = [];
    for (const cp of candidatePlans) {
      const day = cp.startTime ? cp.startTime.slice(0,10) : (cp.startMs ? new Date(cp.startMs).toISOString().slice(0,10) : null);
      const durH = (cp.duration || 0) / 36e5;
      const existingH = existingStudyHoursByDate[day] || 0;
      if (existingH + durH > maxPerDay) {
        // skip this candidate to respect daily limit
        continue;
      }
      // avoid overlapping existing plans
      const sMs = cp.startTime ? new Date(cp.startTime).getTime() : (cp.startMs || 0);
      const eMs = sMs + (cp.duration || 0);
      if (typeof storage.isRangeFree === 'function' && !storage.isRangeFree(sMs, eMs)) continue;
      // accept
      existingStudyHoursByDate[day] = existingH + durH;
      finalPlans.push(cp);
    }

    if (finalPlans.length) storage.setPlans([...existing, ...finalPlans]);
    // done - clear submitting and close the modal
    setSubmitting(false);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl rounded-2xl border p-5 shadow-2xl bg-[#141517] border-[#2a2c2f] text-gray-100">
        <h2 className="font-serifTitle text-2xl mb-2">Quick setup</h2>
        {!ready && <p className="text-sm text-amber-300 mb-2">Add VITE_GEMINI_API_KEY to enable AI planning.</p>}
        {error && <p className="text-sm text-red-400 mb-2">Error: {error}</p>}
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="opacity-80">Schedule screenshot</span>
              <input type="file" accept="image/*" onChange={(e) => setScheduleFile(e.target.files?.[0] || null)} className="mt-1 w-full text-sm" />
            </label>
            <label className="block text-sm">
              <span className="opacity-80">Rank courses (weakest → strongest)</span>
              <input className="mt-1 w-full px-3 py-2 rounded-lg bg-[#1b1d1f] border border-[#2a2c2f]" value={courseRank} onChange={(e) => setCourseRank(e.target.value)} placeholder="Chem, Phys, EE, Calc" />
            </label>
          </div>

          <label className="block text-sm">
            <span className="opacity-80">What is upcoming</span>
            <textarea rows={3} className="mt-1 w-full px-3 py-2 rounded-lg bg-[#1b1d1f] border border-[#2a2c2f]" value={upcoming} onChange={(e) => setUpcoming(e.target.value)} placeholder="- Physics PS3 due Fri&#10;- Chem Lab report due Mon" />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block text-sm">
              <span className="opacity-80">Max study hrs/day</span>
              <input type="number" min={1} max={12} className="mt-1 w-full px-3 py-2 rounded-lg bg-[#1b1d1f] border border-[#2a2c2f]" value={maxStudyPerDay} onChange={(e) => setMaxStudyPerDay(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="opacity-80">No studying past</span>
              <input type="time" className="mt-1 w-full px-3 py-2 rounded-lg bg-[#1b1d1f] border border-[#2a2c2f]" value={latestStudyEnd} onChange={(e) => setLatestStudyEnd(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="opacity-80">Hobby hrs/week</span>
              <input type="number" min={0} max={40} className="mt-1 w-full px-3 py-2 rounded-lg bg-[#1b1d1f] border border-[#2a2c2f]" value={hobbyHours} onChange={(e) => setHobbyHours(e.target.value)} />
            </label>
          </div>

          <label className="block text-sm">
            <span className="opacity-80">Other commitments</span>
            <textarea rows={2} className="mt-1 w-full px-3 py-2 rounded-lg bg-[#1b1d1f] border border-[#2a2c2f]" value={commitments} onChange={(e) => setCommitments(e.target.value)} placeholder="- Work Tue/Thu 4-6pm" />
          </label>

          <label className="block text-sm">
            <span className="opacity-80">Study style</span>
            <input className="mt-1 w-full px-3 py-2 rounded-lg bg-[#1b1d1f] border border-[#2a2c2f]" value={studyStyle} onChange={(e) => setStudyStyle(e.target.value)} placeholder="Focused 50m blocks with 10m breaks" />
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-[#1b1d1f] border border-[#2a2c2f]">Cancel</button>
            <button type="submit" disabled={submitting || loading} className="px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50">
              {submitting || loading ? 'Planning…' : 'Generate Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}