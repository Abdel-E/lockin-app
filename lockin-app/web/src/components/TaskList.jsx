import { useState, useEffect } from 'react';
import { storage } from '../utils/storage';

export function TaskList({ selectedTaskId, onSelectTask, currentSession, isSessionActive, isDarkMode = false }) {
  const [tasks, setTasks] = useState([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskHours, setNewTaskHours] = useState('');
  const [newTaskSubject, setNewTaskSubject] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editHours, setEditHours] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editDue, setEditDue] = useState('');

  useEffect(() => {
    setTasks(storage.getTasks());
    const refresh = () => setTasks(storage.getTasks());
    window.addEventListener('lockin:tasks', refresh);
    return () => window.removeEventListener('lockin:tasks', refresh);
  }, []);
  const loadTasks = () => setTasks(storage.getTasks());

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskName.trim() || !newTaskHours) return;
    const task = storage.addTask(
      newTaskName.trim(),
      parseFloat(newTaskHours),
      newTaskSubject.trim(),
      newTaskDue || null
    );
    storage.upsertPlanForTask(task);
    setNewTaskName('');
    setNewTaskHours('');
    setNewTaskSubject('');
    setNewTaskDue('');
    loadTasks();
  };

  const handleDeleteTask = (id) => {
    storage.deleteTask(id); // only selected one
    if (selectedTaskId === id) onSelectTask?.(null);
    loadTasks();
  };

  const handleStartEdit = (task) => {
    setEditingId(task.id);
    setEditName(task.name);
    setEditHours(task.hoursRemaining.toString());
    setEditSubject(task.subject || '');
    setEditDue(task.dueDate || '');
  };

  const handleSaveEdit = (id) => {
    storage.updateTask(id, editName.trim(), parseFloat(editHours), {
      subject: editSubject.trim(),
      dueDate: editDue || null,
    });
    setEditingId(null);
    loadTasks();
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditHours('');
    setEditSubject('');
    setEditDue('');
  };

  return (
    <div className="space-y-3">
      {/* Add row */}
      <form onSubmit={handleAddTask} className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={newTaskName}
          onChange={(e) => setNewTaskName(e.target.value)}
          placeholder="Task name"
          className={`flex-1 min-w-[200px] px-3 py-2 rounded-lg border ${isDarkMode ? 'bg-[#1b1d1f] text-white border-[#2a2c2f]' : 'bg-white border-[#d6cbc0]'}`}
        />
        <input
          type="number"
          value={newTaskHours}
          onChange={(e) => setNewTaskHours(e.target.value)}
          placeholder="Est. hrs"
          step="0.5"
          min="0"
          className={`w-[110px] px-3 py-2 rounded-lg border ${isDarkMode ? 'bg-[#1b1d1f] text-white border-[#2a2c2f]' : 'bg-white border-[#d6cbc0]'}`}
        />
        <input
          type="text"
          value={newTaskSubject}
          onChange={(e) => setNewTaskSubject(e.target.value)}
          placeholder="Subject"
          className={`flex-1 min-w-[160px] px-3 py-2 rounded-lg border ${isDarkMode ? 'bg-[#1b1d1f] text-white border-[#2a2c2f]' : 'bg-white border-[#d6cbc0]'}`}
        />
        <input
          type="date"
          value={newTaskDue}
          onChange={(e) => setNewTaskDue(e.target.value)}
          className={`w-[170px] px-3 py-2 rounded-lg border ${isDarkMode ? 'bg-[#1b1d1f] text-white border-[#2a2c2f]' : 'bg-white border-[#d6cbc0]'}`}
        />
        <button
          type="submit"
          className={`${isDarkMode ? 'bg-[#2b2f31] text-white border-[#3a3f43]' : 'bg-[#d5cdc5] text-[#2e2e2e] border-[#c6bbb0]'} border rounded-lg px-4 py-2`}
        >
          Add
        </button>
      </form>

      {/* List: fixed height + styled scrollbar */}
      <div className="space-y-2 max-h-[320px] md:max-h-[360px] xl:max-h-[400px] overflow-y-auto pr-1 scroll-area">
        {tasks.map((task) => {
          const isActiveTask = currentSession?.taskId === task.id;
          const isSelected = selectedTaskId === task.id;
          const progress =
            task.estimateHours > 0
              ? ((task.estimateHours - task.hoursRemaining) / task.estimateHours) * 100
              : 0;

          return (
            <div
              key={task.id}
              onClick={() => onSelectTask?.(task.id)}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-[13px] transition-all ${
                isDarkMode ? 'bg-[#0f1011] border-[#2a2c2f] text-gray-100' : 'bg-[#f3efeb] border-[#cebfaf] text-[#2e2e2e]'
              } ${isActiveTask ? 'ring-1 ring-green-500/70' : ''} ${isSelected ? 'shadow-md scale-[1.005]' : ''}`}
            >
              {editingId === task.id ? (
                <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <input className={`flex-1 min-w-[180px] px-2 py-1 rounded border ${isDarkMode ? 'bg-[#1b1d1f] border-[#2a2c2f]' : 'bg-white border-[#d6cbc0]'}`} value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <input className={`w-[90px] px-2 py-1 rounded border ${isDarkMode ? 'bg-[#1b1d1f] border-[#2a2c2f]' : 'bg-white border-[#d6cbc0]'}`} type="number" step="0.5" min="0" value={editHours} onChange={(e) => setEditHours(e.target.value)} />
                  <input className={`flex-1 min-w-[140px] px-2 py-1 rounded border ${isDarkMode ? 'bg-[#1b1d1f] border-[#2a2c2f]' : 'bg-white border-[#d6cbc0]'}`} value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
                  <input className={`w-[150px] px-2 py-1 rounded border ${isDarkMode ? 'bg-[#1b1d1f] border-[#2a2c2f]' : 'bg-white border-[#d6cbc0]'}`} type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)} />
                  <button onClick={() => handleSaveEdit(task.id)} className="px-3 py-1 rounded bg-green-600 text-white">Save</button>
                  <button onClick={handleCancelEdit} className="px-3 py-1 rounded bg-gray-500 text-white">Cancel</button>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="font-medium truncate">{task.name}</div>
                      {isActiveTask && <span className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white">Active</span>}
                    </div>
                    {task.subject && <div className="text-[11px] opacity-70 -mt-0.5 truncate">{task.subject}</div>}

                    <div className="mt-1 text-[11px] flex flex-wrap gap-3">
                      <span>Est: <b>{(task.estimateHours ?? 0).toFixed(1)}h</b></span>
                      <span>Left: <b>{Math.max(0, task.hoursRemaining).toFixed(1)}h</b></span>
                      {task.dueDate && <span>Due: <b>{task.dueDate}</b></span>}
                    </div>

                    <div className="mt-2 h-1.5 w-full rounded-full bg-black/20">
                      <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                    {!isActiveTask && !isSessionActive && (
                      <>
                        <button onClick={() => setEditingId(task.id)} className={`px-3 py-1 rounded ${isDarkMode ? 'bg-[#1b1d1f] text-gray-200 border-[#2a2c2f]' : 'bg-white text-[#2e2e2e] border-[#d6cbc0]'} border`}>
                          Edit
                        </button>
                        <button onClick={() => handleDeleteTask(task.id)} className="px-3 py-1 rounded bg-red-600 text-white">Delete</button>
                      </>
                    )}
                    {isActiveTask && <div className="text-[11px] text-green-500 px-2 py-1">In Progress…</div>}
                    {isSessionActive && !isActiveTask && <div className="text-[11px] opacity-60 px-2 py-1">Locked</div>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {tasks.length === 0 && (<p className={`text-center py-6 text-[13px] ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>No tasks yet.</p>)}
      </div>
    </div>
  );
}
