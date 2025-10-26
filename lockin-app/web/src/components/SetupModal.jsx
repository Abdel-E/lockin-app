import { useState } from 'react';
import { parseWeeklyScheduleImage } from '../utils/scheduleParser';
import { storage } from '../utils/storage';

export default function SetupModal({ open, onClose, onImported, weekStart, isDarkMode }) {
  const [busy, setBusy] = useState(false);
  const [importCount, setImportCount] = useState(0);
  if (!open) return null;

  const handleUpload = async (e) => {
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
          startMs: b.startMs,
          endMs: b.endMs,
          type: 'class',
          source: 'schedule'
        });
      }
      setImportCount(blocks.length);
      onImported?.();
    } catch (err) {
      console.error(err);
      alert('Failed to parse schedule image.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  // Inline section that blends into the existing Setup UI (no overlay)
  return (
    <section className={`w-full rounded-xl p-4 border ${isDarkMode ? 'bg-[#1b1d1f] text-white border-[#2a2c2f]' : 'bg-white text-[#1d2023] border-[#d9cfc5]'}`}>
      <h3 className="text-base font-semibold mb-2">Import your class schedule</h3>
      <p className="text-xs opacity-70 mb-3">
        Upload a screenshot of your CLASS schedule. Parsed classes are added to your calendar in deep maroon.
      </p>
      <label className={`inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border cursor-pointer ${isDarkMode ? 'bg-[#141517] border-[#2a2c2f]' : 'bg-[#f5f1ed] border-[#d9cfc5]'}`}>
        {busy ? 'Parsing…' : 'Choose image'}
        <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={busy} />
      </label>
      {importCount > 0 && <div className="text-xs opacity-80 mt-2">{importCount} classes imported.</div>}
      {/* If your Setup has its own Close/Next buttons, keep this section passive */}
    </section>
  );
}