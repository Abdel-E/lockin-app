import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Alert } from 'react-native';
import ToDoScreen from './app/ToDoScreen';
import TimerScreen from './app/TimerScreen';
import SettingsScreen from './app/SettingsScreen';
import { useSession } from './hooks/useSession';
import { initializeSeedData } from './utils/seedData';
import { storage } from './utils/storage';

const Tab = createBottomTabNavigator();

export default function App() {
  const { currentSession, isConnected, error, startSession, stopSession, userId, syncServerUrl, setSyncServer } = useSession();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    async function init() {
      await initializeSeedData(storage);
      setInitialized(true);
    }
    init();
  }, []);

  useEffect(() => {
    if (error) Alert.alert('Error', error);
  }, [error]);

  if (!initialized) return null;

  return (
    <>
      <StatusBar style="auto" />
      <NavigationContainer>
        <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: '#3B82F6', tabBarInactiveTintColor: '#9CA3AF', tabBarStyle: { paddingBottom: 5, paddingTop: 5, height: 60 }, tabBarLabelStyle: { fontSize: 12, fontWeight: '600' } }}>
          <Tab.Screen name="ToDo" options={{ tabBarLabel: 'Tasks', tabBarBadge: currentSession ? '●' : undefined, tabBarBadgeStyle: { backgroundColor: '#10B981' } }}>
            {(props) => <ToDoScreen {...props} currentSession={currentSession} onLockIn={startSession} />}
          </Tab.Screen>
          <Tab.Screen name="Timer" options={{ tabBarLabel: 'Timer' }}>
            {(props) => <TimerScreen {...props} session={currentSession} onStop={() => stopSession('user')} />}
          </Tab.Screen>
          <Tab.Screen name="Settings" options={{ tabBarLabel: 'Settings' }}>
            {(props) => <SettingsScreen {...props} userId={userId} syncServerUrl={syncServerUrl} setSyncServer={setSyncServer} isConnected={isConnected} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </>
  );
}
