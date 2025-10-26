import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { storage } from '../utils/storage';

export default function TimerScreen({ session, onStop }) {
  const [elapsed, setElapsed] = useState(0);
  const [task, setTask] = useState(null);
  const [profile, setProfile] = useState(null);
  const [dailyProgress, setDailyProgress] = useState(0);

  useEffect(() => {
    if (session) {
      activateKeepAwakeAsync();
      loadTaskAndProfile();
    }
    return () => { deactivateKeepAwake(); };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      const start = new Date(session.startedAt);
      const elapsedSeconds = Math.floor((new Date() - start) / 1000);
      setElapsed(elapsedSeconds);
    }, 1000);
    return () => clearInterval(interval);
  }, [session]);

  useEffect(() => {
    if (session) updateProgress();
  }, [elapsed, session]);

  const loadTaskAndProfile = async () => {
    const tasks = await storage.getTasks();
    setTask(tasks.find(t => t.id === session?.taskId));
    setProfile(await storage.getProfile());
  };

  const updateProgress = async () => {
    if (!profile) return;
    const today = new Date().toISOString().split('T')[0];
    const stats = await storage.getDailyStats(today);
    setDailyProgress(stats.hoursCompleted + (elapsed / 3600));
  };

  const handleStop = () => {
    Alert.alert('End Session', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End', style: 'destructive', onPress: () => onStop() }
    ]);
  };

  if (!session || !task) {
    return (<View style={styles.container}><View style={styles.noSessionContainer}><Text style={styles.noSessionText}>No active session</Text><Text style={styles.noSessionSubtext}>Start from To-Do tab</Text></View></View>);
  }

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const dailyTarget = profile?.studyPrefs?.dailyTargetHours || 3;
  const dailyPercentage = (dailyProgress / dailyTarget) * 100;
  const progressColor = dailyPercentage >= 67 ? '#10B981' : dailyPercentage >= 34 ? '#F59E0B' : '#EF4444';

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.timerContainer}>
          <Text style={styles.timer}>{formattedTime}</Text>
          <Text style={styles.elapsedText}>{Math.floor(elapsed / 60)} minutes</Text>
        </View>
        <View style={styles.taskInfo}>
          <Text style={styles.workingOnText}>Working on</Text>
          <Text style={styles.taskTitle}>{task.title}</Text>
          <Text style={styles.taskCourse}>{task.course}</Text>
        </View>
        <View style={styles.progressContainer}>
          <View style={styles.progressRing}><View style={[styles.progressFill, { width: `${Math.min(dailyPercentage, 100)}%`, backgroundColor: progressColor }]} /></View>
          <Text style={styles.progressText}>{dailyProgress.toFixed(1)}h / {dailyTarget}h today</Text>
        </View>
        <Text style={styles.deviceText}>Started on: <Text style={styles.deviceTextBold}>{session.device}</Text></Text>
        <TouchableOpacity style={styles.lockOutButton} onPress={handleStop}><Text style={styles.lockOutButtonText}>🔓 Lock Out</Text></TouchableOpacity>
        <Text style={styles.warningText}>⚠️ Auto-ends if you leave for 10+ seconds</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#FFFFFF' }, content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }, timerContainer: { alignItems: 'center', marginBottom: 40 }, timer: { fontSize: 64, fontWeight: 'bold', fontFamily: 'monospace', color: '#111827' }, elapsedText: { fontSize: 14, color: '#6B7280', marginTop: 8 }, taskInfo: { alignItems: 'center', paddingVertical: 24, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E5E7EB', width: '100%', marginBottom: 40 }, workingOnText: { fontSize: 14, color: '#6B7280', marginBottom: 8 }, taskTitle: { fontSize: 24, fontWeight: '600', color: '#111827', textAlign: 'center', marginBottom: 4 }, taskCourse: { fontSize: 16, color: '#6B7280' }, progressContainer: { width: '100%', alignItems: 'center', marginBottom: 32 }, progressRing: { width: '100%', height: 16, backgroundColor: '#E5E7EB', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }, progressFill: { height: '100%', borderRadius: 8 }, progressText: { fontSize: 14, color: '#6B7280' }, deviceText: { fontSize: 12, color: '#9CA3AF', marginBottom: 24 }, deviceTextBold: { fontWeight: '600', color: '#6B7280' }, lockOutButton: { backgroundColor: '#EF4444', paddingHorizontal: 48, paddingVertical: 16, borderRadius: 12, width: '100%', alignItems: 'center', marginBottom: 16 }, lockOutButtonText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' }, warningText: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 16 }, noSessionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }, noSessionText: { fontSize: 20, fontWeight: '600', color: '#6B7280', marginBottom: 8 }, noSessionSubtext: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' } });
