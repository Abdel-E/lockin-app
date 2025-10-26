import { GoogleGenerativeAI } from '@google/generative-ai';
import { parseTimeRangeToMinutes, WEEKDAY_INDEX, toLocalDateTime } from './time';

// Convert File/Blob to Gemini inlineData
async function fileToPart(file) {
  const buf = await file.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return { inlineData: { data: b64, mimeType: file.type || 'image/png' } };
}

// Returns [{ id,title,subtitle,day,startMs,endMs,type:'class',source:'schedule' }]
export async function parseWeeklyScheduleImage(file, { weekStartLocal }) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing VITE_GEMINI_API_KEY');
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          classes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                weekday: { type: 'string', enum: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] },
                start: { type: 'string' },
                end: { type: 'string' },
                course: { type: 'string' },
                title: { type: 'string' },
                meetingType: { type: 'string' },
                location: { type: 'string' },
                raw: { type: 'string' }
              },
              required: ['weekday','start','end']
            }
          }
        },
        required: ['classes']
      }
    }
  });

  const instructions = [
    'You are parsing a UNIVERSITY WEEKLY CLASS SCHEDULE screenshot.',
    'Return JSON only. Include one item per class meeting.',
    'Use the exact weekday and times shown (with AM/PM if present).',
    'If AM/PM not printed, infer correctly from campus context (morning 8–11, midday 12–3, afternoon 3–6, evening 6–9).',
    'Include course code, meetingType (LEC/TUT/LAB/PRA/SEM), title if visible, and location if visible.',
    'Do NOT include study blocks or non-class items.'
  ].join(' ');

  const part = await fileToPart(file);
  const resp = await model.generateContent([{ text: instructions }, part]);
  const raw = resp.response.text();

  let json;
  try { json = JSON.parse(raw); }
  catch (e) { console.error('Gemini raw:', raw); throw new Error('Gemini returned non-JSON'); }

  const items = Array.isArray(json.classes) ? json.classes : [];
  const blocks = [];

  for (const it of items) {
    const weekdayKey = String(it.weekday || '').toLowerCase();
    if (!(weekdayKey in WEEKDAY_INDEX)) continue;

    const timeStr = `${it.start ?? ''} - ${it.end ?? ''}`.trim();
    const parsed = parseTimeRangeToMinutes(timeStr || it.raw || '');
    if (!parsed) continue;

    const start = toLocalDateTime(weekStartLocal, WEEKDAY_INDEX[weekdayKey], parsed.startM);
    const end = toLocalDateTime(weekStartLocal, WEEKDAY_INDEX[weekdayKey], parsed.endM);

    const title = (it.course || it.title || 'CLASS').toString().toUpperCase();
    const parts = [];
    if (it.meetingType) parts.push(it.meetingType.toUpperCase());
    if (it.location) parts.push(it.location);
    const subtitle = parts.join(' • ');

    blocks.push({
      id: `${start.getTime()}-${title.replace(/\s+/g, '')}`,
      title,
      subtitle,
      day: weekdayKey,
      startMs: start.getTime(),
      endMs: end.getTime(),
      type: 'class',
      source: 'schedule'
    });
  }
  return blocks;
}