import { GoogleGenerativeAI } from '@google/generative-ai';

export async function interpretTaskIntent(message) {
  if (!message || !message.trim()) {
    return { createTasks: [], deleteAllTasks: false, deleteTasks: [], completeTasks: [] };
  }

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
          createTasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                dueDate: { type: 'string', description: 'YYYY-MM-DD or empty string' },
                hoursRemaining: { type: 'number' },
                notes: { type: 'string' },
                priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] }
              },
              required: ['title']
            }
          },
          deleteAllTasks: { type: 'boolean' },
          deleteTasks: {
            type: 'array',
            items: { type: 'string' }
          },
          completeTasks: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    }
  });

  const prompt = [
    'You help manage a personal to-do list.',
    'Given the USER MESSAGE, output JSON describing the actions:',
    '- createTasks: tasks to add (estimate hoursRemaining as a positive number if implied).',
    '- deleteAllTasks: true if user asked to clear the entire to-do list.',
    '- deleteTasks: titles or keywords of tasks to remove.',
    '- completeTasks: titles/keywords of tasks to mark complete.',
    'Use today’s date contextually when inferring due dates (format YYYY-MM-DD).',
    'Return JSON only.'
  ].join(' ');

  const resp = await model.generateContent([{ text: prompt }, { text: message }]);
  const raw = resp.response.text() || '{}';

  try {
    const parsed = JSON.parse(raw);
    return {
      createTasks: Array.isArray(parsed.createTasks) ? parsed.createTasks : [],
      deleteAllTasks: Boolean(parsed.deleteAllTasks),
      deleteTasks: Array.isArray(parsed.deleteTasks) ? parsed.deleteTasks : [],
      completeTasks: Array.isArray(parsed.completeTasks) ? parsed.completeTasks : []
    };
  } catch (err) {
    console.error('interpretTaskIntent JSON parse failed:', raw);
    throw new Error('Gemini returned invalid task intent JSON');
  }
}