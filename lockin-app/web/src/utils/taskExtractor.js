import { GoogleGenerativeAI } from '@google/generative-ai';

export async function extractTasksFromText(note) {
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
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                dueDate: { type: 'string', description: 'YYYY-MM-DD or empty if none' },
                hoursRemaining: { type: 'number' },
                notes: { type: 'string' },
                priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] }
              },
              required: ['title']
            }
          }
        },
        required: ['tasks']
      }
    }
  });

  const prompt = [
    'From this user request, extract actionable tasks for their to-do list.',
    'For each task provide:',
    '- title (short but descriptive).',
    '- dueDate in YYYY-MM-DD using the user’s local time if a date is implied; otherwise empty string.',
    '- hoursRemaining as a positive number of hours (estimate 1 if unspecified).',
    '- priority (low/medium/high/urgent) inferred from context.',
    '- notes with any extra instructions.',
    'Return JSON matching the schema only.'
  ].join(' ');

  const res = await model.generateContent([{ text: prompt }, { text: note }]);
  const raw = res.response.text();
  const json = JSON.parse(raw || '{"tasks": []}');
  return Array.isArray(json.tasks) ? json.tasks : [];
}