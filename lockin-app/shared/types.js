/**
 * @typedef {{
 *   noStudyAfter?: string,
 *   preferredBlockMins?: number,
 *   breakMins?: number,
 *   dailyTargetHours?: number,
 *   weeklyTargetHours?: number,
 *   hobbyHoursPerWeek?: number,
 *   style?: 'pomodoro'|'deepwork'|'mixed'
 * }} StudyPrefs
 */

/**
 * @typedef {{
 *   id: string,
 *   course: string,
 *   title: string,
 *   dueAt: string
 * }} Deliverable
 */

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   course?: string,
 *   estimateHours: number,
 *   hoursRemaining: number,
 *   dueAt?: string,
 *   priorityScore?: number,
 *   calendarEventId?: string
 * }} Task
 */

/**
 * @typedef {{
 *   id: string,
 *   taskId: string,
 *   startedAt: string,
 *   endedAt?: string,
 *   device: 'web'|'mobile',
 *   status: 'active'|'completed'|'aborted',
 *   elapsedMins: number,
 *   reason?: 'user'|'backgrounded'|'timeout',
 *   lastHeartbeat?: string
 * }} Session
 */

/**
 * @typedef {{
 *   id: string,
 *   email?: string,
 *   courseRankWeakToStrong: string[],
 *   studyPrefs: StudyPrefs,
 *   commitments?: {title: string, when: string}[]
 * }} UserProfile
 */

/**
 * @typedef {{
 *   id: string,
 *   taskId: string,
 *   start: string,
 *   end: string,
 *   source: 'ai'|'user'|'calendar'
 * }} PlanBlock
 */

export const SOCKET_EVENTS = {
  SESSION_START: 'session:start',
  SESSION_STOP: 'session:stop',
  SESSION_HEARTBEAT: 'session:heartbeat',
  SESSION_STARTED: 'session:started',
  SESSION_STOPPED: 'session:stopped',
  SESSION_AUTO_STOP: 'session:autoStop',
  SESSION_REJECTED: 'session:rejected',
  PRESENCE_JOIN: 'presence:join',
  PRESENCE_LEAVE: 'presence:leave',
  SYNC_STATE: 'sync:state'
};

export const HEARTBEAT_INTERVAL = 5000; // 5 seconds
export const SERVER_TTL = 15000; // 15 seconds
export const CLIENT_GRACE_PERIOD = 10000; // 10 seconds
