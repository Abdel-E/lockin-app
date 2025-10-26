import { useCallback, useState } from 'react';
import { useGoogleAuth } from './useGoogleAuth';
import { storage } from '../utils/storage';

const CAL_BASE = 'https://www.googleapis.com/calendar/v3';

export function useCalendarSync() {
  const { isAuthed, ensureToken } = useGoogleAuth();
  const [status, setStatus] = useState('');

  const api = useCallback(async (url, init) => {
    const tok = await ensureToken();
    if (!tok) throw new Error('Not authenticated');
    const res = await fetch(url, {
      ...init,
      headers: { 'Authorization': `Bearer ${tok}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google API ${res.status}: ${text}`);
    }
    return res.status === 204 ? null : res.json();
  }, [ensureToken]);

  const listEvents = useCallback(async (timeMin, timeMax) => {
    const q = new URLSearchParams({
      timeMin, timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '2500',
    });
    const data = await api(`${CAL_BASE}/calendars/primary/events?${q.toString()}`);
    return data?.items || [];
  }, [api]);

  const pullWeek = useCallback(async (start) => {
    setStatus('Pulling…');
    const startISO = new Date(start); startISO.setHours(0,0,0,0);
    const endISO = new Date(startISO); endISO.setDate(endISO.getDate() + 7);
    const events = await listEvents(startISO.toISOString(), endISO.toISOString());

    const plans = storage.getPlans();
    const oursByEventId = new Map(plans.filter(p => p.googleEventId).map(p => [p.googleEventId, p]));

    const imported = [];
    for (const e of events) {
      const startStr = e.start?.dateTime || (e.start?.date ? `${e.start.date}T00:00:00` : null);
      const endStr = e.end?.dateTime || (e.end?.date ? `${e.end.date}T00:00:00` : null);
      if (!startStr || !endStr) continue;

      const startTs = new Date(startStr);
      const endTs = new Date(endStr);
      const duration = Math.max(30 * 60_000, endTs.getTime() - startTs.getTime());

      const lockinId = e.extendedProperties?.private?.lockinId;
      const existing = lockinId ? plans.find(p => p.id === lockinId) : oursByEventId.get(e.id);
      const isOurs = !!existing;

      imported.push({
        id: isOurs ? existing.id : `g_${e.id}`,
        title: isOurs ? (existing.title || e.summary || '(busy)') : (e.summary || '(busy)'),
        subject: isOurs ? (existing.subject || '') : '',
        startTime: new Date(startTs).toISOString(),
        duration,
        taskId: isOurs ? existing.taskId : null,
        color: isOurs ? (existing.color || '#7dd3fc') : '#94a3b8',
        source: 'google',
        googleEventId: e.id,
        googleCalendarId: 'primary',
        readOnly: !isOurs,
      });
    }

    const locals = plans.filter(p => p.source !== 'google');
    const byId = new Map();
    for (const p of imported) byId.set(p.id, p);
    const merged = [...locals, ...byId.values()];
    storage.setPlans(merged);
    setStatus('Pulled');
  }, [listEvents]);

  const pushPending = useCallback(async () => {
    setStatus('Pushing…');
    const plans = storage.getPlans();
    const pending = plans.filter(p => !p.googleEventId && p.source !== 'google');

    for (const p of pending) {
      const start = new Date(p.startTime);
      const end = new Date(start.getTime() + p.duration);
      const body = {
        summary: p.title || 'Study',
        description: p.subject ? `Subject: ${p.subject}` : undefined,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        extendedProperties: { private: { lockinId: p.id } },
      };
      const created = await api(`${CAL_BASE}/calendars/primary/events`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const updated = storage.getPlans().map(x =>
        x.id === p.id ? { ...x, googleEventId: created.id, source: 'google', googleCalendarId: 'primary' } : x
      );
      storage.setPlans(updated);
    }
    setStatus('Pushed');
  }, [api]);

  const updateEventForPlan = useCallback(async (plan) => {
    if (!plan.googleEventId) return;
    const start = new Date(plan.startTime);
    const end = new Date(start.getTime() + plan.duration);
    const patch = {
      summary: plan.title || 'Study',
      description: plan.subject ? `Subject: ${plan.subject}` : undefined,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    };
    await api(`${CAL_BASE}/calendars/primary/events/${encodeURIComponent(plan.googleEventId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }, [api]);

  const deleteEventForPlan = useCallback(async (plan) => {
    if (!plan.googleEventId) return;
    await api(`${CAL_BASE}/calendars/primary/events/${encodeURIComponent(plan.googleEventId)}`, {
      method: 'DELETE',
    });
  }, [api]);

  const syncWeek = useCallback(async (weekStart) => {
    await pushPending();
    await pullWeek(weekStart);
  }, [pushPending, pullWeek]);

  return { isAuthed, status, pullWeek, pushPending, syncWeek, updateEventForPlan, deleteEventForPlan };
}