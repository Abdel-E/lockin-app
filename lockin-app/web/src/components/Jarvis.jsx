import { useEffect, useRef, useState } from 'react';
import { useGemini } from '../hooks/useGemini';
import { storage } from '../utils/storage';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export function Jarvis({ isDarkMode = false }) {
  const { send, interpretCommand, loading, error } = useGemini();
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lockin_jarvis_chat') || '[]'); } catch { return []; }
  });
  const [input, setInput] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('lockin_jarvis_chat', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    const next = [...messages, { role: 'user', text }];
    setMessages(next);
    setInput('');

    // First try to interpret as commands
    const intents = await interpretCommand(text, { tasks: storage.getTasks() });
    if (intents.actions?.length) {
      const results = [];
      const taskNameToId = new Map(storage.getTasks().map(t => [t.name.trim().toLowerCase(), t.id]));
      for (const a of intents.actions) {
        switch (a.type) {
          case 'add_task': {
            const name = a.name?.trim();
            if (!name) { results.push({ ok: false, msg: 'Task name missing.' }); break; }
            const existing = storage.findTaskByName(name);
            if (!existing) {
              const t = storage.addTask(name, Number(a.estimateHours || 1), a.subject || '', a.dueDate || null);
              taskNameToId.set(t.name.trim().toLowerCase(), t.id);
              results.push({ ok: true, msg: `Added task “${t.name}” (${(a.estimateHours ?? 1)}h${a.dueDate ? `, due ${a.dueDate}` : ''}).` });
            } else {
              results.push({ ok: true, msg: `Task “${name}” already exists.` });
            }
            break;
          }
          case 'add_time_block': {
            const taskId = a.taskName ? (storage.findTaskByName(a.taskName)?.id || null) : null;
            if (!a.date) { results.push({ ok: false, msg: 'Time block date missing.' }); break; }
            const block = storage.addPlanBlock({
              title: a.title || (a.taskName ? `Study: ${a.taskName}` : 'Study'),
              taskId,
              subject: a.subject || '',
              date: a.date,
              start: a.start || '17:00',
              end: a.end || null,
              durationHours: a.durationHours != null ? Number(a.durationHours) : null,
            });
            if (block) {
              const hrs = (block.duration / 36e5).toFixed(1);
              const at = new Date(block.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase();
              results.push({ ok: true, msg: `Added ${hrs}h block “${block.title}” on ${block.startTime.slice(0,10)} at ${at}.` });
            } else {
              results.push({ ok: false, msg: 'Failed to add time block.' });
            }
            break;
          }
          default: break;
        }
      }
      const lines = results.map(r => (r.ok ? `✓ ${r.msg}` : `• ${r.msg}`));
      const reply = [intents.assistant || 'Here’s what I did:', ...lines].join('\n');
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
      return;
    }
    // Fallback to regular chat
    const reply = await send(next);
    const safe = reply && reply.length ? reply : 'Sorry, I didn’t get that.';
    setMessages((prev) => [...prev, { role: 'assistant', text: safe }]);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div
        ref={listRef}
        className={`h-64 rounded-xl p-3 mb-3 overflow-y-auto scroll-area ${
          isDarkMode ? 'bg-[#1b1d1f] text-gray-200' : 'bg-[#e8e3de] text-[#2e2e2e]'
        }`}
      >
        {messages.length === 0 && (
          <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            How can I help you lock in today? Use Markdown and LaTeX ($...$, $$...$$).
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`mb-3 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
            <div
              className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === 'user'
                  ? isDarkMode
                    ? 'bg-[#2b2f31] text-white'
                    : 'bg-[#c4b7a9] text-[#1d1d1d]'
                  : isDarkMode
                  ? 'bg-[#0f1011] text-gray-200 border border-[#2a2c2f]'
                  : 'bg-white text-[#2e2e2e] border border-[#d6cbc0]'
              }`}
            >
              {m.role === 'assistant' ? (
                <div className="markdown-body">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      code: ({ inline, className, children, ...props }) =>
                        inline ? (
                          <code className={`${isDarkMode ? 'bg-[#1b1d1f]' : 'bg-[#f3efeb]'} px-1 py-0.5 rounded`} {...props}>
                            {children}
                          </code>
                        ) : (
                          <pre className={`${isDarkMode ? 'bg-[#1b1d1f] text-gray-100' : 'bg-[#f3efeb] text-[#2e2e2e]'} p-2 rounded overflow-auto`}>
                            <code {...props}>{children}</code>
                          </pre>
                        ),
                      a: ({ children, ...props }) => (
                        <a className="underline text-blue-500 hover:text-blue-400" target="_blank" rel="noreferrer" {...props}>
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {m.text}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{m.text}</div>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="text-xs opacity-70">Jarvis is thinking…</div>}
        {error && <div className="text-xs text-red-400">Error: {error}</div>}
      </div>

      <div className="flex items-center gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder="Type Markdown/LaTeX. Shift+Enter for newline."
          className={`flex-1 rounded-xl px-3 py-2 text-sm resize-none ${
            isDarkMode
              ? 'bg-[#1b1d1f] text-white border border-[#2a2c2f]'
              : 'bg-white text-[#2e2e2e] border border-[#d6cbc0]'
          }`}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className={`px-4 py-2 rounded-xl ${isDarkMode ? 'bg-[#2b2f31] text-white' : 'bg-[#d5cdc5] text-[#2e2e2e]'} disabled:opacity-50`}
        >
          Send
        </button>
      </div>
    </div>
  );
}