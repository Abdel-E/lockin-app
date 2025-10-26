import { useRef, useState, useEffect } from 'react';
import { createJarvisChat } from '../utils/geminiClient';
import { parseWeeklyScheduleImage } from '../utils/scheduleParser';
import { interpretTaskIntent } from '../utils/taskIntentParser';
import { storage } from '../utils/storage';

export function Jarvis({ isDarkMode, weekStart, onClassesImported }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const chatRef = useRef(null);
  const clientRef = useRef(null);
  const importedImagesRef = useRef(new Set());

  // Initialize Gemini chat client
  if (!clientRef.current) {
    try {
      clientRef.current = createJarvisChat();
    } catch (err) {
      console.error('Gemini client init failed:', err);
    }
  }

  const imageKey = (file) => `${file.name}-${file.size}-${file.lastModified}`;

  const sanitizeReply = (text) => {
    if (!text) return '';
    const trimmed = text.trim();
    if (trimmed.startsWith('```')) return '';
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) return '';
    return text;
  };

  function savePlan(plan) {
    if (typeof storage.getPlans === 'function' && typeof storage.setPlans === 'function') {
      const plans = storage.getPlans() || [];
      // Mark schedule/class plans as immutable to preserve them from being
      // overwritten by later planning merges.
      if (plan && (plan.type === 'class' || plan.source === 'schedule')) plan.immutable = true;
      storage.setPlans([
        ...plans.filter((p) => p?.id !== plan.id),
        plan,
      ]);
      return;
    }
    if (storage.PLANS_KEY) {
      const plans = JSON.parse(localStorage.getItem(storage.PLANS_KEY) || '[]');
      const next = [...plans.filter((p) => p?.id !== plan.id), plan];
      localStorage.setItem(storage.PLANS_KEY, JSON.stringify(next));
      storage._emit?.('plans');
      return;
    }
    throw new Error('No storage method available to persist plans.');
  }

  function saveTask({ title, hoursRemaining, notes, priority, dueDate }) {
    if (typeof storage.addTask === 'function') {
      const before = storage.getTasks?.() || [];
      const beforeIds = new Set(before.map((t) => t.id));

      const created = storage.addTask(
        title,
        hoursRemaining,
        [priority ? priority.toUpperCase() : null, notes || null].filter(Boolean).join(' • '),
        dueDate || null
      );

      if (created && created.id) return created;

      const after = storage.getTasks?.() || [];
      const diff = after.find((t) => !beforeIds.has(t.id));
      return diff || after[after.length - 1] || null;
    }

    if (storage.TASKS_KEY) {
      const tasks = storage.getTasks?.() || [];
      const now = new Date().toISOString();
      const task = {
        id: crypto?.randomUUID ? crypto.randomUUID() : `task_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: title,
        estimateHours: hoursRemaining,
        hoursRemaining,
        subject: [priority ? priority.toUpperCase() : null, notes || null].filter(Boolean).join(' • '),
        dueDate: dueDate || null,
        createdAt: now,
      };
      const next = [...tasks, task];
      localStorage.setItem(storage.TASKS_KEY, JSON.stringify(next));
      storage._emit?.('tasks');
      return task;
    }

    throw new Error('No storage method available to create tasks.');
  }

  // NEW: task helpers used by applyTaskIntent
  function clearAllTasks() {
    const tasks = (typeof storage.getTasks === 'function' ? storage.getTasks() : []) || [];
    if (!tasks.length || typeof storage.deleteTask !== 'function') return 0;
    let count = 0;
    for (const t of tasks) {
      try {
        storage.deleteTask(t.id);
        storage.deletePlansForTask?.(t.id);
        count += 1;
      } catch {}
    }
    return count;
  }

  function removeTasksByTitle(keywords = []) {
    const tasks = (typeof storage.getTasks === 'function' ? storage.getTasks() : []) || [];
    if (!tasks.length || typeof storage.deleteTask !== 'function') return { removed: 0 };
    const needles = keywords.map((k) => String(k || '').toLowerCase().trim()).filter(Boolean);
    if (!needles.length) return { removed: 0 };

    let removed = 0;
    for (const t of tasks) {
      const title = String(t.name || t.title || '').toLowerCase();
      if (needles.some((n) => title.includes(n))) {
        try {
          storage.deleteTask(t.id);
          storage.deletePlansForTask?.(t.id);
          removed += 1;
        } catch {}
      }
    }
    return { removed };
  }

  function completeTasksByTitle(keywords = []) {
    const tasks = (typeof storage.getTasks === 'function' ? storage.getTasks() : []) || [];
    if (!tasks.length || typeof storage.updateTask !== 'function') return { updated: 0 };
    const needles = keywords.map((k) => String(k || '').toLowerCase().trim()).filter(Boolean);
    if (!needles.length) return { updated: 0 };

    let updated = 0;
    for (const t of tasks) {
      const title = String(t.name || '').toLowerCase();
      if (needles.some((n) => title.includes(n))) {
        try {
          storage.updateTask(t.id, t.name, 0, {
            estimateHours: t.estimateHours,
            subject: t.subject,
            dueDate: t.dueDate,
          });
          updated += 1;
        } catch {}
      }
    }
    return { updated };
  }

  function scheduleTaskBlock({ task, hours, dueDate }) {
    if (!task) return false;

    // Prefer the app’s native planner so Calendar sees the block
    if (typeof storage.upsertPlanForTask === 'function') {
      // Ensure the task has the fields planner expects
      const hrs = Math.max(0.5, Number(hours) || Number(task.hoursRemaining) || 1);
      const next = {
        ...task,
        name: task.name || task.title || 'Task',
        hoursRemaining: hrs,
        estimateHours: task.estimateHours ?? hrs,
        dueDate: dueDate ?? task.dueDate ?? null,
      };
      // Check occupancy: compute start/end ms the planner would use (upsertPlanForTask uses dueDate->17:00)
      const day = new Date(next.dueDate || new Date().toISOString().slice(0,10));
      day.setHours(17,0,0,0);
      const startMs = new Date(day).getTime();
      const duration = Math.max(30 * 60_000, (next.estimateHours || hrs) * 36e5);
      const endMs = startMs + duration;
      if (typeof storage.isRangeFree === 'function' && !storage.isRangeFree(startMs, endMs)) return false;
      storage.upsertPlanForTask(next);           // creates/updates the block for this task
      window.dispatchEvent?.(new Event('lockin:plans'));
      return true;
    }

    // Fallback: synthesize a single block
    const durationHours = Math.max(0.5, Number(hours) || 1);
    let start = null;

    if (dueDate) {
      const parts = dueDate.split('-').map(Number);
      if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
        start = new Date(parts[0], parts[1] - 1, parts[2], 9, 0, 0, 0);
      }
    }
    if (!start || Number.isNaN(start.getTime())) {
      start = new Date();
      start.setHours(start.getHours() + 1, 0, 0, 0);
    }

    const startMs = start.getTime();
    const endMs = startMs + durationHours * 3600000;
    const planTitle = task.name || task.title || 'Task';
    const planSubtitle = task.subject || '';
    const planId = task.id ? `plan-${task.id}` : `plan-${startMs}`;

    if (typeof storage.addPlanBlock === 'function') {
      storage.deletePlansForTask?.(task.id);
      storage.addPlanBlock({
        title: planTitle,
        taskId: task.id ?? null,
        subject: planSubtitle,
        date: start.toLocaleDateString('en-CA'),
        start: start.toTimeString().slice(0, 5),
        durationHours,
        color: '#7dd3fc',
      });
      window.dispatchEvent?.(new Event('lockin:plans'));
      return true;
    }

    const plans = storage.getPlans?.() || [];
    const plan = {
      id: planId,
      title: planTitle,
      subtitle: planSubtitle,
      taskId: task.id ?? null,
      startTime: start.toISOString(),
      duration: endMs - startMs,
      startMs,
      endMs,
      type: 'task',
      source: 'task',
    };
    if (typeof storage.isRangeFree === 'function' && !storage.isRangeFree(startMs, endMs)) return false;
    if (typeof storage.setPlans === 'function') {
      storage.setPlans([...plans.filter((p) => p?.id !== planId), plan]);
      window.dispatchEvent?.(new Event('lockin:plans'));
      return true;
    }
    return false;
  }

  const applyTaskIntent = async (intent) => {
    if (!intent) return null;

    let created = 0;
    let clearedCount = 0;
    let removed = 0;
    let completed = 0;
    let scheduled = 0;

    if (intent.deleteAllTasks) {
      clearedCount = clearAllTasks();
    } else if (intent.deleteTasks?.length) {
      const res = removeTasksByTitle(intent.deleteTasks);
      removed = res.removed;
    }

    if (intent.completeTasks?.length) {
      const res = completeTasksByTitle(intent.completeTasks);
      completed = res.updated;
    }

    if (intent.createTasks?.length) {
      for (const t of intent.createTasks) {
        const hours = Number.isFinite(t.hoursRemaining) && t.hoursRemaining > 0 ? t.hoursRemaining : 1;
        const due = (t.dueDate || '').trim() || null;

        const storedTask = saveTask({
          title: t.title,
          hoursRemaining: hours,
          notes: t.notes || '',
          priority: t.priority || '',
          dueDate: due,
        });

        if (storedTask) {
          created += 1;
          if (scheduleTaskBlock({ task: storedTask, hours, dueDate: due })) {
            scheduled += 1;
          }
        }
      }
    }

    if (created || clearedCount || removed || completed) {
      window.dispatchEvent(new Event('lockin:tasks'));
    }
    if (scheduled) {
      window.dispatchEvent(new Event('lockin:plans'));
    }

    const parts = [];
    if (created) parts.push(`added ${created} task${created === 1 ? '' : 's'}`);
    if (scheduled) parts.push(`scheduled ${scheduled} block${scheduled === 1 ? '' : 's'}`);
    if (clearedCount) parts.push(`cleared ${clearedCount} task${clearedCount === 1 ? '' : 's'}`);
    if (removed) parts.push(`removed ${removed} task${removed === 1 ? '' : 's'}`);
    if (completed) parts.push(`marked ${completed} task${completed === 1 ? '' : 's'} complete`);

    return parts.length ? `Done: ${parts.join(', ')}.` : null;
  };

  const importFromImages = async (images, { force = false } = {}) => {
    if (!images?.length) return 0;
    let total = 0;

    for (const img of images) {
      const key = imageKey(img);
      if (!force && importedImagesRef.current.has(key)) continue;

      const blocks = await parseWeeklyScheduleImage(img, { weekStartLocal: weekStart });
      if (!blocks.length) continue;

      for (const b of blocks) {
        // Skip if a plan with this id already exists (prevents duplicate re-imports/loops)
        const existing = storage.getPlans?.() || [];
        if (existing.some((p) => p && p.id === b.id)) continue;
        savePlan({
          id: b.id,
          title: b.title,
          subtitle: b.subtitle,
          startTime: new Date(b.startMs).toISOString(),
          duration: b.endMs - b.startMs,
          startMs: b.startMs,
          endMs: b.endMs,
          type: 'class',
          source: 'schedule',
        });
        total += 1;
      }
      importedImagesRef.current.add(key);
    }

    if (total > 0) {
      window.dispatchEvent(new Event('lockin:plans'));
      onClassesImported?.(total);
    }
    return total;
  };

  const onPick = (e) => {
    const picked = [...(e.target.files || [])];
    if (!picked.length) return;
    setFiles((prev) => [...prev, ...picked]);
    e.target.value = '';
  };

  const onPaste = (e) => {
    const items = e.clipboardData?.items || [];
    const imgs = [];
    for (const it of items) {
      if (it.kind === 'file') {
        const f = it.getAsFile();
        if (f && f.type.startsWith('image/')) imgs.push(f);
      }
    }
    if (imgs.length) {
      e.preventDefault();
      setFiles((prev) => [...prev, ...imgs]);
    }
  };

  const send = async () => {
    if (!input.trim() && files.length === 0) return;
    const client = clientRef.current;
    if (!client) {
      setMessages((m) => [...m, { role: 'model', text: 'Gemini client not initialized. Check your API key.' }]);
      return;
    }

    const attachments = files;
    const text = input.trim();
    const userMsg = { role: 'user', text, images: attachments };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setFiles([]);
    setBusy(true);

    try {
      const reply = await client.send({ text: userMsg.text, files: attachments });
      const sanitized = sanitizeReply(reply);

      let importedCount = 0;
      let importError = null;
      if (attachments.length) {
        try {
          importedCount = await importFromImages(attachments);
        } catch (err) {
          importError = err?.message || 'Unknown error importing classes.';
        }
      }

      let intentMessage = null;
      let intentError = null;
      if (text) {
        try {
          const intent = await interpretTaskIntent(text);
          const message = await applyTaskIntent(intent);
          intentMessage = message;
        } catch (err) {
          intentError = err?.message || 'Unable to interpret task instructions.';
        }
      }

      const updates = [];
      if (sanitized) updates.push({ role: 'model', text: sanitized });
      if (intentMessage) updates.push({ role: 'model', text: intentMessage });
      if (intentError) updates.push({ role: 'model', text: `Task handling failed: ${intentError}` });
      if (importedCount > 0) {
        updates.push({
          role: 'model',
          text: `Imported ${importedCount} class meeting${importedCount === 1 ? '' : 's'} into your calendar.`
        });
      } else if (importError) {
        updates.push({ role: 'model', text: `Failed to import classes: ${importError}` });
      }
      if (!updates.length) updates.push({ role: 'model', text: 'Done.' });

      setMessages((m) => [...m, ...updates]);
    } catch (err) {
      console.error(err);
      setMessages((m) => [...m, { role: 'model', text: 'Sorry, something went wrong talking to Gemini.' }]);
    } finally {
      setBusy(false);
    }
  };

  // Smooth auto-scroll on new messages
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // UI only (functionality unchanged)
  return (
    <div className={`flex flex-col h-[500px] overflow-hidden rounded-xl ${isDarkMode ? 'bg-[#111316] text-white' : 'bg-white text-[#1d2023]'}`}>
      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((m, i) => {
          const isUser = m.role === 'user';
          const bubbleClass = isUser
            ? (isDarkMode ? 'ml-auto bg-[#0b2a4a] text-white' : 'ml-auto bg-blue-600 text-white')
            : (isDarkMode ? 'mr-auto bg-[#191c20] text-white' : 'mr-auto bg-[#f3f4f6] text-[#111827]');
          return (
            <div key={i} className={`max-w-[78%] rounded-lg px-3 py-2 shadow-sm ${bubbleClass}`}>
              {m.images?.length ? (
                <div className="flex gap-2 mb-2 flex-wrap">
                  {m.images.map((f, j) => (
                    <img
                      key={j}
                      src={URL.createObjectURL(f)}
                      alt="attachment"
                      className="w-20 h-14 object-cover rounded border border-black/10"
                    />
                  ))}
                </div>
              ) : null}
              <div className="text-[13px] leading-5 whitespace-pre-wrap">{m.text}</div>
            </div>
          );
        })}
        {busy && (
          <div className={`text-xs opacity-70 ${isDarkMode ? 'text-white/80' : 'text-[#1d2023]/70'} mx-auto`}>Thinking…</div>
        )}
      </div>

      {/* Pending attachments preview */}
      {files.length > 0 && (
        <div className="px-3 pb-2 flex gap-2 flex-wrap">
          {files.map((f, i) => (
            <div key={i} className="relative">
              <img src={URL.createObjectURL(f)} className="w-16 h-12 object-cover rounded border border-black/10" alt="pending" />
              <button
                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black/70 text-white text-[10px] leading-none flex items-center justify-center"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row (paperclip + input + send) */}
      <div className={`p-3 flex items-center gap-2 border-t ${isDarkMode ? 'border-white/10' : 'border-black/10'}`}>
        <label
          className={`h-8 w-8 inline-flex items-center justify-center rounded-full border cursor-pointer ${
            isDarkMode ? 'bg-[#14171b] border-[#2a2c2f] text-gray-100' : 'bg-[#f5f1ed] border-[#d9cfc5] text-[#2e2e2e]'
          }`}
          title="Attach image"
        >
          📎
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const picked = [...(e.target.files || [])];
              if (picked.length) setFiles((p) => [...p, ...picked]);
              e.target.value = '';
            }}
            multiple
          />
        </label>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={onPaste}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          className={`flex-1 rounded-md px-3 py-2 text-sm outline-none ${
            isDarkMode ? 'bg-[#14171b] border border-[#2a2c2f] text-white' : 'bg-[#fbf9f6] border border-[#d9cfc5] text-[#1d2023]'
          }`}
          placeholder="Ask Jarvis… paste or attach images for context"
        />

        <button
          disabled={busy}
          onClick={send}
          className={`text-sm px-3 py-1.5 rounded-md border ${
            isDarkMode ? 'bg-[#14171b] border-[#2a2c2f] text-gray-100' : 'bg-[#f5f1ed] border-[#d9cfc5] text-[#2e2e2e]'
          } ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Send
        </button>
      </div>
    </div>
  );
}