// LocalStorage-only storage with light schema helpers
class LocalStorage {
  constructor() {
    this.TASKS_KEY = 'lockin_tasks';
    this.PLANS_KEY = 'lockin_plans';
    this.PREFS_KEY = 'lockin_prefs';
    this.SESSIONS_KEY = 'lockin_sessions';
  }

  // Notify UI to refresh
  _emit(type) {
    try {
      window.dispatchEvent(new CustomEvent(`lockin:${type}`));
    } catch {}
  }

  // Preferences
  getPreferences() {
    try { return JSON.parse(localStorage.getItem(this.PREFS_KEY) || 'null'); } catch { return null; }
  }
  setPreferences(prefs) {
    localStorage.setItem(this.PREFS_KEY, JSON.stringify(prefs || {}));
  }

  // ---- Tasks ----
  getTasks() {
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
  }

  addTask(name, estimateHours, subject = '', dueDate = null) {
    const tasks = this.getTasks();
    const task = {
      id: crypto.randomUUID?.() || Date.now().toString(),
      name,
      estimateHours,
      hoursRemaining: estimateHours,
      subject,
      dueDate,
      createdAt: new Date().toISOString(),
    };
    tasks.push(task);
    localStorage.setItem(this.TASKS_KEY, JSON.stringify(tasks));
    this._emit('tasks');
    return task; // ensure we return the created task
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
      return updated;
    }
  }

  // FIX: delete only the selected task (and its plan)
  deleteTask(id) {
    if (!id) return;
    const tasks = this.getTasks();
    const next = tasks.filter((t) => t.id !== id);
    localStorage.setItem(this.TASKS_KEY, JSON.stringify(next));
    // remove its planned block(s)
    this.deletePlansForTask(id);
    this._emit('tasks');
    this._emit('plans');
  }

  // ---- Sessions (actual tracked sessions) ----
  getSessions() {
    return JSON.parse(localStorage.getItem(this.SESSIONS_KEY) || '[]');
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

  // ---- Planned sessions (calendar blocks) ----
  getPlans() {
    return JSON.parse(localStorage.getItem(this.PLANS_KEY) || '[]');
  }
  setPlans(plans) {
    const merged = this.mergeContiguousPlans(plans || []);
    localStorage.setItem(this.PLANS_KEY, JSON.stringify(merged));
    this._emit('plans');
  }

  // Collapse consecutive slices for same task/title on same day
  mergeContiguousPlans(plans) {
    const sorted = [...(plans || [])].sort(
      (a, b) => new Date(a.startTime) - new Date(b.startTime)
    );
    const out = [];
    for (const p of sorted) {
      if (!out.length) { out.push({ ...p }); continue; }
      const prev = out[out.length - 1];
      const sameDay =
        new Date(prev.startTime).toDateString() === new Date(p.startTime).toDateString();
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

  // Creates/updates a single planned block based on task dueDate and estimateHours
  upsertPlanForTask(task) {
    const all = this.getPlans().filter(Boolean);
    const duration =
      Math.max(30 * 60_000, Number(task.estimateHours ?? task.hoursRemaining ?? 1) * 36e5);

    // Default start at 17:00 on due date (or today if no due); adjust as needed by your UI
    const day = new Date(task.dueDate || new Date().toISOString().slice(0, 10));
    day.setHours(17, 0, 0, 0);

    const idx = all.findIndex((p) => p.taskId === task.id);
    const block = {
      id: idx >= 0 ? all[idx].id : `plan_${task.id}`,
      taskId: task.id,
      title: task.name ? `Study: ${task.name}` : 'Study',
      subject: task.subject || '',
      startTime: new Date(day).toISOString(),
      duration,
      color: idx >= 0 ? all[idx].color : '#7dd3fc',
    };
    if (idx >= 0) all[idx] = block; else all.push(block);
    this.setPlans(all); // will merge/normalize
  }

  deletePlansForTask(taskId) {
    const plans = this.getPlans().filter((p) => p.taskId !== taskId);
    this.setPlans(plans);
  }

  // ---- Stats ----
  getDailyStats(dateStr) {
    const sessions = this.getSessions();
    const dayStart = new Date(dateStr);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateStr);
    dayEnd.setHours(23, 59, 59, 999);

    const daySessions = sessions.filter((s) => {
      const t = new Date(s.startTime);
      return s.endTime && t >= dayStart && t <= dayEnd;
    });

    const totalTime = daySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    return { totalTime, sessionCount: daySessions.length, sessions: daySessions };
  }

  getWeekStats(anchorDate = new Date()) {
    const d = new Date(anchorDate);
    const day = d.getDay(); // Sun:0
    const diffToMon = (day + 6) % 7;
    const start = new Date(d);
    start.setDate(d.getDate() - diffToMon);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    end.setHours(0, 0, 0, -1);

    const sessions = this.getSessions().filter((s) => {
      const t = new Date(s.startTime);
      return s.endTime && t >= start && t <= end;
    });

    const totalTime = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    return { totalTime, targetHours: this.WEEK_TARGET_HOURS, sessions };
  }

  // ---- Export/Import ----
  exportAll() {
    return { tasks: this.getTasks(), sessions: this.getSessions(), plans: this.getPlans() };
  }
  importAll(data) {
    if (data.tasks) localStorage.setItem(this.TASKS_KEY, JSON.stringify(data.tasks));
    if (data.sessions) localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(data.sessions));
    if (data.plans) this.setPlans(data.plans);
  }
  clearAll() {
    localStorage.removeItem(this.TASKS_KEY);
    localStorage.removeItem(this.SESSIONS_KEY);
    localStorage.removeItem(this.PLANS_KEY);
  }
}
export const storage = new LocalStorage();
