import { useRef, useState } from 'react';
import { createJarvisChat } from '../utils/geminiClient';
import { parseWeeklyScheduleImage } from '../utils/scheduleParser';
import { storage } from '../utils/storage';

export default function JarvisChat({ weekStart, isDarkMode }) {
  const [messages, setMessages] = useState([]); // {role:'user'|'model', text, images?: File[]}
  const [input, setInput] = useState('');
  const [files, setFiles] = useState([]); // pending attachments
  const [busy, setBusy] = useState(false);
  const chatRef = useRef(null);
  const clientRef = useRef(null);

  if (!clientRef.current) clientRef.current = createJarvisChat();

  const onPick = (e) => {
    const f = [...(e.target.files || [])];
    if (!f.length) return;
    setFiles((prev) => [...prev, ...f]);
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

    const userMsg = { role: 'user', text: input, images: files };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setBusy(true);
    try {
      const reply = await client.send({ text: userMsg.text, files: userMsg.images });
      setMessages((m) => [...m, { role: 'model', text: reply }]);
      setFiles([]);
      // scroll to bottom
      setTimeout(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }), 0);
    } catch (e) {
      console.error(e);
      setMessages((m) => [...m, { role: 'model', text: 'Sorry, something went wrong talking to Gemini.' }]);
    } finally {
      setBusy(false);
    }
  };

  const importClassesFromLastImage = async () => {
    const last = [...messages].reverse().find((m) => m.role === 'user' && m.images?.length);
    if (!last) return;
    const img = last.images[0];
    setBusy(true);
    try {
      const blocks = await parseWeeklyScheduleImage(img, { weekStartLocal: weekStart });
      for (const b of blocks) {
        // Use storage helper that converts schedule-style blocks into calendar plans
        storage.addPlanBlockFromSchedule?.({
          id: b.id,
          title: b.title,
          subtitle: b.subtitle,
          startMs: b.startMs,
          endMs: b.endMs,
          type: 'class',
          source: 'schedule',
        });
      }
      setMessages((m) => [...m, { role: 'model', text: `Imported ${blocks.length} class meetings into your calendar.` }]);
      window.dispatchEvent?.(new Event('lockin:plans'));
    } catch (e) {
      console.error(e);
      setMessages((m) => [...m, { role: 'model', text: 'Failed to import classes from the image.' }]);
    } finally {
      setBusy(false);
    }
  };

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div className={`flex flex-col h-full rounded-xl border ${isDarkMode ? 'bg-[#1b1d1f] border-[#2a2c2f] text-white' : 'bg-white border-[#d9cfc5] text-[#1d2023]'}`}>
      <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[78%] rounded-lg px-3 py-2 ${m.role === 'user' ? 'ml-auto bg-blue-600/20' : 'mr-auto bg-gray-500/10'}`}>
            {m.images?.length ? (
              <div className="flex gap-2 mb-2">
                {m.images.map((f, j) => (
                  <img key={j} src={URL.createObjectURL(f)} alt="attachment" className="w-24 h-16 object-cover rounded border border-black/10" />
                ))}
              </div>
            ) : null}
            <div className="text-sm whitespace-pre-wrap">{m.text}</div>
          </div>
        ))}
      </div>

      {files.length > 0 && (
        <div className="px-3 pb-2 flex gap-2 flex-wrap">
          {files.map((f, i) => (
            <div key={i} className="relative">
              <img src={URL.createObjectURL(f)} className="w-16 h-12 object-cover rounded border border-black/10" />
              <button onClick={() => removeFile(i)} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black/70 text-white text-[10px]">×</button>
            </div>
          ))}
        </div>
      )}

      <div className="p-3 flex items-center gap-2 border-t border-black/10">
        <label className={`text-xs px-3 py-1 rounded-full border cursor-pointer ${isDarkMode ? 'bg-[#141517] border-[#2a2c2f]' : 'bg-[#f5f1ed] border-[#d9cfc5]'}`}>
          Attach image
          <input type="file" accept="image/*" className="hidden" onChange={onPick} multiple />
        </label>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={onPaste}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          className={`flex-1 rounded-md px-3 py-2 text-sm outline-none ${isDarkMode ? 'bg-[#141517] border border-[#2a2c2f] text-white' : 'bg-[#fbf9f6] border border-[#d9cfc5] text-[#1d2023]'}`}
          placeholder="Ask Jarvis… paste or attach images for context"
        />

        <button
          disabled={busy}
          onClick={send}
          className={`text-sm px-3 py-1.5 rounded-full border ${isDarkMode ? 'bg-[#141517] border-[#2a2c2f]' : 'bg-[#f5f1ed] border-[#d9cfc5]'}`}
        >
          {busy ? 'Thinking…' : 'Send'}
        </button>

        {/* Quick action for scheduling from last image */}
        <button
          disabled={busy}
          onClick={importClassesFromLastImage}
          title="Import classes from the most recent attached image"
          className={`text-xs px-3 py-1 rounded-full border ${isDarkMode ? 'bg-[#311016] border-[#4b1c25] text-white' : 'bg-[#f6e9ec] border-[#e6cad1] text-[#5c0f21]'}`}
        >
          Import classes
        </button>
      </div>
    </div>
  );
}