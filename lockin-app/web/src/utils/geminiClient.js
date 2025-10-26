import { GoogleGenerativeAI } from '@google/generative-ai';

export async function fileToPart(file) {
  const buf = await file.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return { inlineData: { data: b64, mimeType: file.type || 'image/png' } };
}

export function createJarvisChat() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing VITE_GEMINI_API_KEY');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction:
      'You are Jarvis, a concise productivity assistant. You can reason over images users attach. If asked, produce structured JSON.',
  });

  const chat = model.startChat({ history: [] });

  async function send({ text, files = [] }) {
    const parts = [];
    if (text?.trim()) parts.push({ text });
    for (const f of files) parts.push(await fileToPart(f));
    const res = await chat.sendMessage(parts);
    return res.response.text();
  }

  return { send };
}