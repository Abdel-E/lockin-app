import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';

export default function SettingsScreen({ userId, syncServerUrl, setSyncServer, isConnected }) {
  const [serverInput, setServerInput] = useState('');

  useEffect(() => {
    if (syncServerUrl) setServerInput(syncServerUrl);
  }, [syncServerUrl]);

  const handleConnect = async () => {
    if (!serverInput.trim()) {
      Alert.alert('Error', 'Please enter sync server URL');
      return;
    }
    await setSyncServer(serverInput.trim());
    Alert.alert('Success', 'Connected!');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}><Text style={styles.title}>⚙️ Settings</Text></View>
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? '#10B981' : '#EF4444' }]} />
            <Text style={styles.statusText}>{isConnected ? 'Connected' : 'Disconnected'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User ID</Text>
          <Text style={styles.userIdText}>{userId}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sync Server URL</Text>
          <TextInput style={styles.input} value={serverInput} onChangeText={setServerInput} placeholder="http://192.168.1.x:4000" placeholderTextColor="#9CA3AF" autoCapitalize="none" autoCorrect={false} />
          <TouchableOpacity style={styles.button} onPress={handleConnect}><Text style={styles.buttonText}>Connect</Text></TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          <Text style={styles.instructions}>1. Start sync server on your computer{'\n'}2. Note the local IP address{'\n'}3. Enter: http://YOUR_IP:4000{'\n'}4. Tap Connect{'\n'}5. Start studying!</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#F3F4F6' }, header: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }, title: { fontSize: 24, fontWeight: 'bold', color: '#111827' }, content: { padding: 16 }, section: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 16 }, sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 }, statusRow: { flexDirection: 'row', alignItems: 'center' }, statusDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 }, statusText: { fontSize: 16, color: '#6B7280' }, userIdText: { fontSize: 14, fontFamily: 'monospace', color: '#6B7280', backgroundColor: '#F3F4F6', padding: 12, borderRadius: 8 }, input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 16, color: '#111827', marginBottom: 12 }, button: { backgroundColor: '#3B82F6', paddingVertical: 12, borderRadius: 8, alignItems: 'center' }, buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' }, instructions: { fontSize: 14, color: '#6B7280', lineHeight: 20 } });
