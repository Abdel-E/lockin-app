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
    const tasks = this.getTasks();
    const task = {
      id: uid(),
      name,
      estimateHours: Number(estimateHours || 0),
      hoursRemaining: Number(estimateHours || 0),
      subject,
      dueDate,
      createdAt: new Date().toISOString(),
    };
    tasks.push(task);
    localStorage.setItem(this.TASKS_KEY, JSON.stringify(tasks));
    this._emit('tasks');
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
    const merged = this.mergeContiguousPlans(plans || []);
    localStorage.setItem(this.PLANS_KEY, JSON.stringify(merged));
    this._emit('plans');
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

    const day = new Date(task.dueDate || new Date().toISOString().slice(0, 10));
    day.setHours(17, 0, 0, 0);

    const idx = all.findIndex((p) => p.taskId === task.id);
    const block = {
      id: idx >= 0 ? all[idx].id : `plan_${uid()}`,
      taskId: task.id,
      title: task.name ? `Study: ${task.name}` : 'Study',
      subject: task.subject || '',
      startTime: new Date(day).toISOString(),
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
