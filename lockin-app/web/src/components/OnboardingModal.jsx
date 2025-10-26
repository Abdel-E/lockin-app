import { useEffect, useState } from 'react';
import { useGemini } from '../hooks/useGemini';
import { storage } from '../utils/storage';

export default function OnboardingModal({ open, onClose }) {
  const { ready, planFromScreenshot, loading, error } = useGemini();
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
    const prefs = {
      courseRank,
      maxStudyPerDay: Number(maxStudyPerDay) || 4,
      latestStudyEnd,
      commitments,
      hobbyHours: Number(hobbyHours) || 0,
      studyStyle,
    };
    storage.setPreferences(prefs);

    const result = await planFromScreenshot({ file: scheduleFile, upcoming, prefs });

    // create tasks
    const created = [];
    for (const t of result.tasks || []) {
      const task = storage.addTask(t.name, t.estimateHours || 1, t.subject || '', t.dueDate || null);
      created.push({ name: t.name.toLowerCase(), id: task.id });
    }
    const map = new Map(created.map((x) => [x.name, x.id]));
    // create plans
    const plans = (result.plans || []).map((p, idx) => {
      const start = `${p.date}T${(p.start || '17:00')}:00`;
      const [sh, sm] = (p.start || '17:00').split(':').map((n) => parseInt(n || '0', 10));
      const [eh, em] = (p.end || '18:00').split(':').map((n) => parseInt(n || '0', 10));
      const duration = (eh * 60 + em - (sh * 60 + sm)) * 60_000;
      return {
        id: `plan_${Date.now()}_${idx}`,
        taskId: p.taskName ? map.get(p.taskName.toLowerCase()) || null : null,
        title: p.title || p.taskName || 'Study',
        subject: p.subject || '',
        startTime: new Date(start).toISOString(),
        duration: Math.max(duration || 0, 30 * 60_000),
        color: '#7dd3fc',
      };
    });
    if (plans.length) storage.setPlans(plans);
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
            <button type="submit" disabled={!ready || loading} className="px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50">
              {loading ? 'Planning…' : 'Generate Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}