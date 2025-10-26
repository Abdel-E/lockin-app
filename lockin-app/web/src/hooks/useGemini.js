import { useMemo, useState } from 'react';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const b64 = (r.result || '').toString().split(',').pop();
      resolve(b64 || '');
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function extractJSON(text) {
  const block = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const raw = block ? block[1] : text;
  try { return JSON.parse(raw); } catch { return { tasks: [], plans: [] }; }
}

export function useGemini() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const ready = !!apiKey;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const send = useMemo(() => {
    if (!apiKey) return async () => 'Gemini not configured.';
    return async (messages) => {
      try {
        setLoading(true); setError(null);
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const system = `You are Jarvis, a concise study assistant.
Respond in Markdown with LaTeX ($...$, $$...$$). Do not wrap math in code fences.`;
        const prompt = [system, ...messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)].join('\n');

        const res = await model.generateContent(prompt);
        const text = res?.response?.text?.() ?? '';
        return text.trim();
      } catch (e) {
        setError(e.message); return null;
      } finally { setLoading(false); }
    };
  }, [apiKey]);

  // Natural language → JSON actions Jarvis should perform
  async function interpretCommand(userText, context = {}) {
    if (!apiKey) return { assistant: null, actions: [] };
    setLoading(true); setError(null);
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const schema = `
Return ONLY JSON (no prose) with:
{
  "assistant": "short user-facing reply",
  "actions": [
    { "type": "add_time_block", "title": "Study MAT186", "taskName": "MAT186 Assignment", "subject": "Math", "date": "YYYY-MM-DD", "start": "HH:MM", "end": "HH:MM", "durationHours": 1.5 },
    { "type": "add_task", "name": "Chem HW", "estimateHours": 2, "subject": "Chem", "dueDate": "YYYY-MM-DD" }
  ]
}
Rules:
- Use the next 7 days, resolve phrases like "tomorrow" to an absolute ISO date.
- For add_time_block, include either end or durationHours (prefer durationHours).`;

      const parts = [
        { text: schema },
        { text: `Today: ${new Date().toISOString().slice(0,10)}` },
        { text: `User: ${userText}` },
        { text: `Existing tasks: ${JSON.stringify(context.tasks ?? [])}` },
      ];

      const res = await model.generateContent(parts);
      const text = res?.response?.text?.() ?? '';
      const json = extractJSON(text);
      return { assistant: json.assistant || null, actions: Array.isArray(json.actions) ? json.actions : [] };
    } catch (e) {
      setError(e.message);
      return { assistant: null, actions: [] };
    } finally {
      setLoading(false);
    }
  }

  async function planFromScreenshot({ file, upcoming, prefs }) {
    if (!apiKey) return { tasks: [], plans: [] };
    setLoading(true); setError(null);
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const parts = [];
      const system = `You are an academic planning assistant. Parse the user's schedule image and preferences, then return STRICT JSON only.
Schema:
{"tasks":[{"name":"","subject":"","estimateHours":0,"dueDate":"YYYY-MM-DD"}],
 "plans":[{"title":"","taskName":"","subject":"","date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM"}]}
Rules: respect prefs.latestStudyEnd and prefs.maxStudyPerDay; prioritize weaker courses first; avoid conflicts with commitments and the image; plan within the next 7 days. Keep JSON under 120 lines.`;
      parts.push({ text: system });
      parts.push({ text: `Today is ${new Date().toISOString().slice(0,10)}.` });
      if (upcoming?.trim()) parts.push({ text: `Upcoming:\n${upcoming}` });
      if (prefs) parts.push({ text: `Preferences:\n${JSON.stringify(prefs)}` });
      if (file) {
        const base64 = await fileToBase64(file);
        parts.push({ inlineData: { mimeType: file.type || 'image/png', data: base64 } });
      } else {
        parts.push({ text: 'No schedule image provided.' });
      }

      const res = await model.generateContent(parts);
      const text = res?.response?.text?.() ?? '';
      const json = extractJSON(text);
      return {
        tasks: Array.isArray(json.tasks) ? json.tasks : [],
        plans: Array.isArray(json.plans) ? json.plans : [],
      };
    } catch (e) {
      setError(e.message);
      return { tasks: [], plans: [] };
    } finally {
      setLoading(false);
    }
  }

  return { ready, send, interpretCommand, loading, error, planFromScreenshot };
}