import { useState } from 'react';
import { parseWeeklyScheduleImage } from '../utils/scheduleParser';
import { storage } from '../utils/storage';

export default function ScheduleUpload({ weekStart }) {
  const [busy, setBusy] = useState(false);
  const onChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const blocks = await parseWeeklyScheduleImage(file, { weekStartLocal: weekStart });

      for (const b of blocks) {
        storage.addPlan?.({
          id: b.id,
          title: b.title,
          subtitle: b.subtitle,
          startMs: b.startMs,       // local/system time epoch
          endMs: b.endMs,
          type: 'class',            // ensure Calendar treats it as a class
          source: 'schedule'
        });
      }
      alert(`Imported ${blocks.length} classes.`);
    } catch (err) {
      console.error(err);
      alert('Failed to parse schedule image.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  return (
    <label className="text-xs px-3 py-1 rounded-full border cursor-pointer">
      {busy ? 'Parsing…' : 'Upload Class Schedule'}
      <input type="file" accept="image/*" className="hidden" onChange={onChange} />
    </label>
  );
}