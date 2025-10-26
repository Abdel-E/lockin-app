import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  USER_ID: 'lockin_userId',
  PROFILE: 'lockin_profile',
  TASKS: 'lockin_tasks',
  SESSIONS: 'lockin_sessions',
  DAILY_STATS: 'lockin_dailyStats',
  SYNC_SERVER: 'lockin_syncServer'
};

export const storage = {
  async getUserId() {
    let userId = await AsyncStorage.getItem(KEYS.USER_ID);
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem(KEYS.USER_ID, userId);
    }
    return userId;
  },

  async setSyncServer(url) {
    await AsyncStorage.setItem(KEYS.SYNC_SERVER, url);
  },

  async getSyncServer() {
    return await AsyncStorage.getItem(KEYS.SYNC_SERVER);
  },

  async getProfile() {
    const data = await AsyncStorage.getItem(KEYS.PROFILE);
    return data ? JSON.parse(data) : null;
  },

  async saveProfile(profile) {
    await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
  },

  async getTasks() {
    const data = await AsyncStorage.getItem(KEYS.TASKS);
    return data ? JSON.parse(data) : [];
  },

  async saveTasks(tasks) {
    await AsyncStorage.setItem(KEYS.TASKS, JSON.stringify(tasks));
  },

  async getSessions() {
    const data = await AsyncStorage.getItem(KEYS.SESSIONS);
    return data ? JSON.parse(data) : [];
  },

  async saveSessions(sessions) {
    await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
  },

  async getDailyStats(date = new Date().toISOString().split('T')[0]) {
    const data = await AsyncStorage.getItem(KEYS.DAILY_STATS);
    const stats = data ? JSON.parse(data) : {};
    return stats[date] || { date, hoursCompleted: 0, sessionCount: 0 };
  },

  async saveDailyStats(date, stats) {
    const data = await AsyncStorage.getItem(KEYS.DAILY_STATS);
    const allStats = data ? JSON.parse(data) : {};
    allStats[date] = stats;
    await AsyncStorage.setItem(KEYS.DAILY_STATS, JSON.stringify(allStats));
  },

  async exportAll() {
    return {
      userId: await AsyncStorage.getItem(KEYS.USER_ID),
      profile: JSON.parse(await AsyncStorage.getItem(KEYS.PROFILE) || 'null'),
      tasks: JSON.parse(await AsyncStorage.getItem(KEYS.TASKS) || '[]'),
      sessions: JSON.parse(await AsyncStorage.getItem(KEYS.SESSIONS) || '[]'),
      dailyStats: JSON.parse(await AsyncStorage.getItem(KEYS.DAILY_STATS) || '{}')
    };
  },

  async importAll(data) {
    if (data.userId) await AsyncStorage.setItem(KEYS.USER_ID, data.userId);
    if (data.profile) await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(data.profile));
    if (data.tasks) await AsyncStorage.setItem(KEYS.TASKS, JSON.stringify(data.tasks));
    if (data.sessions) await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(data.sessions));
    if (data.dailyStats) await AsyncStorage.setItem(KEYS.DAILY_STATS, JSON.stringify(data.dailyStats));
  },

  async clear() {
    await AsyncStorage.multiRemove(Object.values(KEYS));
  }
};
