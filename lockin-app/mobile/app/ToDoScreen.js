import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { format } from 'date-fns';
import { storage } from '../utils/storage';

export default function ToDoScreen({ navigation, currentSession, onLockIn }) {
  const [tasks, setTasks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    const loadedTasks = await storage.getTasks();
    const sorted = [...loadedTasks].sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      return b.hoursRemaining - a.hoursRemaining;
    });
    setTasks(sorted);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  };

  const handleLockIn = (taskId) => {
    onLockIn(taskId);
    navigation.navigate('Timer');
  };

  const getUrgencyColor = (task) => {
    if (!task.dueAt) return '#9CA3AF';
    const daysUntilDue = (new Date(task.dueAt) - new Date()) / (1000 * 60 * 60 * 24);
    if (daysUntilDue < 1) return '#EF4444';
    if (daysUntilDue < 3) return '#F59E0B';
    return '#10B981';
  };

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <Text style={styles.title}>🔒 Lock-In Tasks</Text>
        {currentSession && (
          <View style={styles.activeIndicator}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>Active</Text>
          </View>
        )}
      </View>

      <View style={styles.tasksList}>
        {tasks.map((task) => {
          const isActiveTask = currentSession?.taskId === task.id;
          const progress = ((task.estimateHours - task.hoursRemaining) / task.estimateHours) * 100;
          
          return (
            <View key={task.id} style={[styles.taskCard, { borderLeftColor: getUrgencyColor(task), borderLeftWidth: 4 }, isActiveTask && styles.activeTaskCard]}>
              <View style={styles.taskHeader}>
                <View style={styles.taskInfo}>
                  <View style={styles.taskTitleRow}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    {isActiveTask && (<View style={styles.lockedBadge}><Text style={styles.lockedText}>LOCKED IN</Text></View>)}
                  </View>
                  <Text style={styles.taskCourse}>{task.course}</Text>
                  {task.dueAt && (<Text style={styles.taskDue}>Due {format(new Date(task.dueAt), 'MMM d, h:mm a')}</Text>)}
                  <Text style={styles.taskHours}><Text style={styles.taskHoursBold}>{task.hoursRemaining.toFixed(1)}h</Text> remaining of {task.estimateHours}h</Text>
                  <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]} /></View>
                </View>
              </View>

              <View style={styles.taskActions}>
                {!currentSession ? (
                  <TouchableOpacity style={styles.lockInButton} onPress={() => handleLockIn(task.id)}><Text style={styles.lockInButtonText}>Lock In</Text></TouchableOpacity>
                ) : isActiveTask ? (
                  <Text style={styles.inProgressText}>In Progress...</Text>
                ) : (
                  <TouchableOpacity style={styles.lockedButton} disabled><Text style={styles.lockedButtonText}>Locked</Text></TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#F3F4F6' }, header: { padding: 20, backgroundColor: '#FFFFFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }, title: { fontSize: 24, fontWeight: 'bold', color: '#111827' }, activeIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 }, activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }, activeText: { color: '#10B981', fontSize: 14, fontWeight: '600' }, tasksList: { padding: 16 }, taskCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 }, activeTaskCard: { backgroundColor: '#EFF6FF', borderWidth: 2, borderColor: '#3B82F6' }, taskHeader: { marginBottom: 12 }, taskInfo: { flex: 1 }, taskTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 }, taskTitle: { fontSize: 18, fontWeight: '600', color: '#111827', flex: 1 }, lockedBadge: { backgroundColor: '#3B82F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }, lockedText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' }, taskCourse: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginBottom: 2 }, taskDue: { fontSize: 13, color: '#6B7280', marginBottom: 4 }, taskHours: { fontSize: 13, color: '#6B7280', marginBottom: 8 }, taskHoursBold: { fontWeight: '600', color: '#111827' }, progressBar: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }, progressFill: { height: '100%', backgroundColor: '#3B82F6' }, taskActions: { alignItems: 'flex-end' }, lockInButton: { backgroundColor: '#10B981', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 }, lockInButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' }, lockedButton: { backgroundColor: '#D1D5DB', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 }, lockedButtonText: { color: '#6B7280', fontSize: 16, fontWeight: '600' }, inProgressText: { color: '#6B7280', fontSize: 14 } });
