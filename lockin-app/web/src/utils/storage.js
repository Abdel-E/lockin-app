// LocalStorage-only storage with light schema helpers

// Safe ID generator
function uid() {
  try {
    return (crypto && crypto.randomUUID) ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  } catch {
    return `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

class LocalStorage {
  constructor() {
    this.TASKS_KEY = 'lockin_tasks';
    this.PLANS_KEY = 'lockin_plans';
    this.PREFS_KEY = 'lockin_prefs';
    this.SESSIONS_KEY = 'lockin_sessions';
  }

  // Notify UI to refresh
  _emit(type) {
    try { window.dispatchEvent(new CustomEvent(`lockin:${type}`)); } catch {}
  }

  // ---------- Preferences ----------
  getPreferences() {
    try { return JSON.parse(localStorage.getItem(this.PREFS_KEY) || 'null'); } catch { return null; }
  }
  setPreferences(prefs) {
    localStorage.setItem(this.PREFS_KEY, JSON.stringify(prefs || {}));
  }

  // ---------- Tasks ----------
  getTasks() {
    try {
      const tasks = JSON.parse(localStorage.getItem(this.TASKS_KEY) || '[]');
      return tasks.map((t) => ({
        id: t.id,
        name: t.name ?? 'Untitled',
        estimateHours: typeof t.estimateHours === 'number' ? t.estimateHours : (t.hoursRemaining ?? 0),
        hoursRemaining: typeof t.hoursRemaining === 'number' ? t.hoursRemaining : (t.estimateHours ?? 0),
        subject: t.subject || '',
        dueDate: t.dueDate || null,
        createdAt: t.createdAt || new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  }

  addTask(name, estimateHours, subject = '', dueDate = null) {
    // Normalize dueDate: ensure YYYY-MM-DD or null. Guard against bad years (e.g., 2023 returned by Gemini).
    let normDue = null;
    try {
      if (dueDate) {
        const s = String(dueDate).trim();
        const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (ymd) {
          normDue = `${ymd[1]}-${String(ymd[2]).padStart(2, '0')}-${String(ymd[3]).padStart(2, '0')}`;
        } else {
          // Try parsing other common formats
          const parsed = new Date(s);
          if (!Number.isNaN(parsed.getTime())) {
            const yr = parsed.getFullYear();
            const nowYr = new Date().getFullYear();
            // If year looks wildly off, snap to current year
            const year = yr < 2000 || yr > nowYr + 5 ? nowYr : yr;
            const mm = String(parsed.getMonth() + 1).padStart(2, '0');
            const dd = String(parsed.getDate()).padStart(2, '0');
            normDue = `${year}-${mm}-${dd}`;
          } else {
            // if parsing failed, leave null
            normDue = null;
          }
        }
      }
    } catch (e) {
      normDue = null;
    }

    const tasks = this.getTasks();
    const task = {
      id: uid(),
      name,
      estimateHours: Number(estimateHours || 0),
      hoursRemaining: Number(estimateHours || 0),
      subject,
      dueDate: normDue,
      createdAt: new Date().toISOString(),
    };
    tasks.push(task);
    localStorage.setItem(this.TASKS_KEY, JSON.stringify(tasks));
    this._emit('tasks');
    // Automatically create a plan for this task (unless caller opts out by passing opts.skipUpsert)
    // NOTE: callers using addTask internally can pass a fourth argument 'opts' with { skipUpsert: true }
    // to avoid creating a plan (used internally when syncing plans -> tasks).
    try {
      // If caller passed an options object as the last argument, respect skipUpsert.
      const lastArg = arguments[arguments.length - 1];
      const opts = typeof lastArg === 'object' && lastArg && !Array.isArray(lastArg) ? lastArg : {};
      if (!opts.skipUpsert) {
        // best-effort upsert of a plan for the task
        this.upsertPlanForTask(task);
      }
    } catch (e) {
      // noop
    }
    return task;
  }

  updateTask(id, name, hoursRemaining, opts = {}) {
    const tasks = this.getTasks();
    const i = tasks.findIndex((t) => t.id === id);
    if (i !== -1) {
      tasks[i] = {
        ...tasks[i],
        name: name ?? tasks[i].name,
        hoursRemaining: typeof hoursRemaining === 'number' ? hoursRemaining : tasks[i].hoursRemaining,
        subject: opts.subject ?? tasks[i].subject,
        dueDate: opts.dueDate ?? tasks[i].dueDate,
        estimateHours: typeof opts.estimateHours === 'number' ? opts.estimateHours : tasks[i].estimateHours,
      };
      localStorage.setItem(this.TASKS_KEY, JSON.stringify(tasks));
      this._emit('tasks');
      return tasks[i];
    }
    return null;
  }

  deleteTask(id) {
    if (!id) return;
    const tasks = this.getTasks().filter((t) => t.id !== id);
    localStorage.setItem(this.TASKS_KEY, JSON.stringify(tasks));
    this.deletePlansForTask(id);
    this._emit('tasks');
    this._emit('plans');
  }

  findTaskByName(name) {
    if (!name) return null;
    const n = String(name).trim().toLowerCase();
    return this.getTasks().find((t) => t.name.trim().toLowerCase() === n) || null;
  }

  // ---------- Sessions (timer history) ----------
  getSessions() {
    try { return JSON.parse(localStorage.getItem(this.SESSIONS_KEY) || '[]'); } catch { return []; }
  }
  addSession(session) {
    const sessions = this.getSessions();
    sessions.push(session);
    localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
    return session;
  }
  updateSession(updated) {
    const sessions = this.getSessions();
    const i = sessions.findIndex((s) => s.id === updated.id);
    if (i !== -1) {
      sessions[i] = updated;
      localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
    }
  }

  // ---------- Stats ----------
  getDailyStats(date = new Date()) {
    try {
      const dayStart = new Date(date); dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
      const sessions = (this.getSessions() || []).filter((s) => {
        const t = new Date(s.startTime || s.start || 0).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      });
      let totalMs = 0;
      const byTask = {};
      for (const s of sessions) {
        const start = new Date(s.startTime || s.start || 0).getTime();
        const end = s.endTime || s.end ? new Date(s.endTime || s.end).getTime() : start + (s.duration || s.durationMs || 0);
        const dur = Math.max(0, (end || 0) - (start || 0));
        totalMs += dur;
        if (s.taskId) byTask[s.taskId] = (byTask[s.taskId] || 0) + dur;
      }
      return {
        date: dayStart.toISOString().slice(0,10),
        totalMs,
        totalHours: +(totalMs / 36e5).toFixed(2),
        sessions,
        byTask,
      };
    } catch {
      return { date: new Date().toISOString().slice(0,10), totalMs: 0, totalHours: 0, sessions: [], byTask: {} };
    }
  }

  getWeekStats(weekStart = new Date()) {
    try {
      const start = new Date(weekStart); start.setHours(0,0,0,0);
      const days = [];
      let totalMs = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        const s = this.getDailyStats(d);
        days.push({ date: s.date, totalMs: s.totalMs, totalHours: s.totalHours });
        totalMs += s.totalMs;
      }
      return {
        startDate: start.toISOString().slice(0,10),
        days,
        totalMs,
        totalHours: +(totalMs / 36e5).toFixed(2),
      };
    } catch {
      return { startDate: new Date().toISOString().slice(0,10), days: [], totalMs: 0, totalHours: 0 };
    }
  }

  // ---------- Plans (calendar blocks) ----------
  getPlans() {
    try { return JSON.parse(localStorage.getItem(this.PLANS_KEY) || '[]'); } catch { return []; }
  }

  setPlans(plans) {
    // Deduplicate incoming plans by id (keep last occurrence), then merge contiguous plans
    const byId = new Map();
    for (const p of (plans || [])) {
      if (!p) continue;
      if (p.id) byId.set(p.id, p);
    }
    const deduped = Array.from(byId.values());
    const merged = this.mergeContiguousPlans(deduped || []);

    // Enforce immutability of schedule/class blocks: do not allow any non-schedule
    // plan to overlap an existing schedule block. Build a list of sacred ranges
    // from schedule/class plans and filter out any conflicting incoming plans.
    const scheduleBlocks = (merged || []).filter((p) => p && (p.type === 'class' || p.source === 'schedule'))
      .map((p) => ({
        id: p.id,
        startMs: p.startMs || (p.startTime ? new Date(p.startTime).getTime() : null),
        endMs: p.endMs || (p.startTime ? (new Date(p.startTime).getTime() + (p.duration || 0)) : null),
      }))
      .filter((s) => s.startMs != null && s.endMs != null);

    const filtered = [];
    for (const p of merged) {
      if (!p) continue;
      // keep schedule blocks always
      if (p.type === 'class' || p.source === 'schedule') { filtered.push(p); continue; }
      // compute range
      const ps = p.startMs || (p.startTime ? new Date(p.startTime).getTime() : null);
      const pe = p.endMs || (p.startTime ? (new Date(p.startTime).getTime() + (p.duration || 0)) : null);
      if (ps == null || pe == null) { filtered.push(p); continue; }
      // if overlaps any schedule block, skip it to preserve immutability
      let overlapsSchedule = false;
      for (const s of scheduleBlocks) {
        if (ps < s.endMs && pe > s.startMs) { overlapsSchedule = true; break; }
      }
      if (overlapsSchedule) {
        // drop this incoming plan — do not overwrite schedule slots
        // keep a console warning for debugging
        try { console.warn('Skipping plan that overlaps immutable schedule block:', p); } catch {}
        continue;
      }
      filtered.push(p);
    }

    // For any non-class plan that lacks a taskId, create a lightweight task so todos and calendar stay in sync.
    const tasks = this.getTasks();
    for (const p of filtered) {
      if (p.type === 'class' || p.source === 'schedule') continue;
      if (p.taskId) continue;
      // Try to find existing task by title
      const found = this.findTaskByName(p.title);
      if (found) {
        p.taskId = found.id;
      } else {
        // Create a task but skip upserting a plan for it to avoid cycles
        const created = this.addTask(p.title || 'Task', Math.max(1, Math.round((p.duration || 3600000) / 36e5)), p.subject || '', p.date || null, { skipUpsert: true });
        p.taskId = created.id;
      }
    }

    localStorage.setItem(this.PLANS_KEY, JSON.stringify(filtered));
    this._emit('plans');
  }

  // Return true if the given time range [startMs, endMs) does not overlap any existing plan
  isRangeFree(startMs, endMs) {
    try {
      const plans = this.getPlans() || [];
      for (const p of plans) {
        const ps = p.startMs || (p.startTime ? new Date(p.startTime).getTime() : null);
        const pe = p.endMs || (p.startTime ? (new Date(p.startTime).getTime() + (p.duration || 0)) : null);
        if (ps != null && pe != null && startMs < pe && endMs > ps) return false;
      }
      return true;
    } catch (e) {
      return true;
    }
  }

  // Add a single plan block parsed from a schedule image (startMs/endMs style) or a standard plan.
  addPlanBlockFromSchedule(block) {
    if (!block) return null;
    // block expected: { id, title, subtitle, startMs, endMs, type:'class'|'class', source:'schedule' }
    try {
      const startMs = Number(block.startMs || block.start || 0);
      const endMs = Number(block.endMs || block.end || 0);
      if (!startMs || !endMs || endMs <= startMs) return null;
      const plan = {
        id: block.id || `plan_${uid()}`,
        title: block.title || 'CLASS',
        subtitle: block.subtitle || '',
        startTime: new Date(startMs).toISOString(),
        duration: Math.max(30 * 60_000, endMs - startMs),
        // Also keep raw ms fields so Calendar can render schedule-style blocks
        startMs: startMs,
        endMs: endMs,
        // schedule blocks are immutable (cannot be overwritten or overlapped)
        immutable: true,
        type: 'class',
        source: 'schedule',
        googleEventId: null,
        googleCalendarId: 'primary',
      };
      const all = this.getPlans();
      // Avoid adding duplicate schedule blocks with same id
      if (all.some((p) => p && p.id === plan.id)) return null;
      // Do not add if it overlaps any existing block (respect calendar occupancy)
      const start = plan.startMs || new Date(plan.startTime).getTime();
      const end = plan.endMs || (new Date(plan.startTime).getTime() + (plan.duration || 0));
      for (const p of all) {
        try {
          const ps = p.startMs || (p.startTime ? new Date(p.startTime).getTime() : null);
          const pe = p.endMs || (p.startTime ? (new Date(p.startTime).getTime() + (p.duration || 0)) : null);
          if (ps != null && pe != null && start < pe && end > ps) {
            return null;
          }
        } catch {}
      }
      all.push(plan);
      this.setPlans(all);
      return plan;
    } catch (e) {
      return null;
    }
  }

  clearPlans() {
    this.setPlans([]);
  }

  deletePlansForTask(taskId) {
    const next = this.getPlans().filter((p) => p.taskId !== taskId);
    localStorage.setItem(this.PLANS_KEY, JSON.stringify(next));
  }

  addPlanBlock({ title, taskId = null, subject = '', date, start = '17:00', end = null, durationHours = null, color = '#7dd3fc' }) {
    if (!date) return null;
    const startTime = new Date(`${date}T${start || '17:00'}:00`);
    let duration = 0;
    if (end) {
      const [eh, em] = String(end).split(':').map((n) => parseInt(n || '0', 10));
      const endTime = new Date(startTime);
      endTime.setHours(eh || 0, em || 0, 0, 0);
      duration = Math.max(0, endTime.getTime() - startTime.getTime());
    } else if (durationHours != null) {
      duration = Number(durationHours) * 36e5;
    }
    duration = Math.max(duration, 30 * 60_000);

    const plans = this.getPlans();
    const block = {
      id: `plan_${uid()}`,
      taskId,
      title: title || 'Study',
      subject,
      startTime: startTime.toISOString(),
      duration,
      color,
      source: 'local',
      googleEventId: null,
      googleCalendarId: 'primary',
    };
    plans.push(block);
    this.setPlans(plans);
    return block;
  }

  upsertPlanForTask(task) {
    if (!task || !task.id) return null;
    const all = this.getPlans().filter(Boolean);
    const duration = Math.max(30 * 60_000, Number(task.estimateHours ?? task.hoursRemaining ?? 1) * 36e5);

    // Helper: try to find a free startMs for the given duration on/around the due date
    const findFreeStartForDuration = (preferredDate, durMs, maxForwardDays = 7) => {
      try {
        const day = new Date(preferredDate);
        day.setHours(0, 0, 0, 0);
        // try the preferred day first, attempting to place a block ending at 17:00 and
        // scanning earlier in 30-minute steps down to 08:00
        const preferredEndHour = 17;
        const earliestHour = 8;
        const step = 30 * 60_000;
        const endAt = new Date(day); endAt.setHours(preferredEndHour, 0, 0, 0);
        let attemptStart = endAt.getTime() - durMs;
        const earliest = new Date(day); earliest.setHours(earliestHour, 0, 0, 0); const earliestMs = earliest.getTime();
        // scan earlier on preferred day
        for (let s = attemptStart; s >= earliestMs; s -= step) {
          if (this.isRangeFree(s, s + durMs)) return s;
        }
        // scan forward days (from the preferred day + 1) and try earliest available slot between 08:00..22:00
        for (let d = 0; d < maxForwardDays; d++) {
          const candDay = new Date(day); candDay.setDate(day.getDate() + d);
          const dayStart = new Date(candDay); dayStart.setHours(8, 0, 0, 0);
          const dayEnd = new Date(candDay); dayEnd.setHours(22, 0, 0, 0);
          for (let s = dayStart.getTime(); s + durMs <= dayEnd.getTime(); s += step) {
            if (this.isRangeFree(s, s + durMs)) return s;
          }
        }
      } catch (e) { /* ignore and fallback */ }
      return null;
    };

    const preferredDate = task.dueDate || new Date().toISOString().slice(0, 10);
    const chosenStart = findFreeStartForDuration(preferredDate, duration, 7) || (new Date(preferredDate + 'T17:00:00').getTime());

    const idx = all.findIndex((p) => p.taskId === task.id);
    const startMs = Number(chosenStart || (new Date().getTime()));
    const block = {
      id: idx >= 0 ? all[idx].id : `plan_${uid()}`,
      taskId: task.id,
      title: task.name ? `Study: ${task.name}` : 'Study',
      subject: task.subject || '',
      startTime: new Date(startMs).toISOString(),
      startMs,
      endMs: startMs + duration,
      duration,
      color: idx >= 0 ? all[idx].color : '#7dd3fc',
      source: idx >= 0 ? all[idx].source || 'local' : 'local',
      googleEventId: idx >= 0 ? (all[idx].googleEventId || null) : null,
      googleCalendarId: 'primary',
    };
    if (idx >= 0) all[idx] = block; else all.push(block);
    this.setPlans(all);
    return block;
  }

  // Merge adjacent slices into one contiguous block
  mergeContiguousPlans(plans) {
    const sorted = [...(plans || [])]
      .filter(Boolean)
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    const out = [];
    for (const p of sorted) {
      if (!out.length) { out.push({ ...p }); continue; }
      const prev = out[out.length - 1];
      const sameDay = new Date(prev.startTime).toDateString() === new Date(p.startTime).toDateString();
      const sameLabel =
        (prev.taskId && p.taskId && prev.taskId === p.taskId) ||
        (String(prev.title || '').trim().toLowerCase() === String(p.title || '').trim().toLowerCase());
      const prevEnd = new Date(prev.startTime).getTime() + (prev.duration || 0);
      const currStart = new Date(p.startTime).getTime();
      if (sameDay && sameLabel && Math.abs(currStart - prevEnd) <= 60_000) {
        prev.duration = (prev.duration || 0) + (p.duration || 0);
      } else {
        out.push({ ...p });
      }
    }
    return out;
  }
}

export const storage = new LocalStorage();
