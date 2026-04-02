import React, { useState, useRef, useEffect } from 'react';
import { Animated, View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SetupScreen from './src/screens/SetupScreen';
import Dashboard from './src/screens/Dashboard';
import WorkoutEngine from './src/screens/WorkoutEngine';
import CompletionScreen from './src/screens/CompletionScreen';
import SplashScreen from './src/screens/SplashScreen';
import StatsScreen from './src/screens/StatsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { updateStreak } from './src/services/localStore';

function FadeScreen({ children }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 300, useNativeDriver: true
    }).start();
  }, []);
  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      {children}
    </Animated.View>
  );
}

function BottomNav({ activeTab, onTabPress }) {
  const tabs = [
    { key: 'dashboard', emoji: '🏠', label: 'Plano' },
    { key: 'stats', emoji: '📊', label: 'Stats' },
    { key: 'profile', emoji: '👤', label: 'Perfil' },
  ];

  return (
    <View style={navStyles.container}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={navStyles.tab}
          onPress={() => onTabPress(tab.key)}
        >
          <Text style={navStyles.emoji}>{tab.emoji}</Text>
          <Text style={[navStyles.label, activeTab === tab.key && navStyles.labelActive]}>
            {tab.label}
          </Text>
          {activeTab === tab.key && <View style={navStyles.dot} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const navStyles = StyleSheet.create({
  container: {
    flexDirection: 'row', backgroundColor: '#1e1e1e',
    borderTopWidth: 1, borderTopColor: '#333', paddingBottom: 34, paddingTop: 10
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  emoji: { fontSize: 22 },
  label: { color: '#666', fontSize: 11 },
  labelActive: { color: '#4ade80' },
  dot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: '#4ade80', marginTop: 2
  },
});

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [profile, setProfile] = useState(null);
  const [currentWorkout, setCurrentWorkout] = useState(null);
  const [completedWorkout, setCompletedWorkout] = useState(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [dashboardKey, setDashboardKey] = useState(0);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const saved = await AsyncStorage.getItem('userProfile');
    if (saved) setProfile(JSON.parse(saved));
  };

  const handleWorkoutComplete = async () => {
    const saved = await AsyncStorage.getItem('workoutPlan');
    if (saved) {
      const plan = JSON.parse(saved);
      const updated = plan.map((day) =>
        day.day_number === currentWorkout.day_number
          ? { ...day, completed: true }
          : day
      );
      await AsyncStorage.setItem('workoutPlan', JSON.stringify(updated));
    }
    const streakData = await updateStreak();
    setCurrentStreak(streakData.current);
    setCompletedWorkout(currentWorkout);
    setCurrentWorkout(null);
  };

  const handleReset = async () => {
    await AsyncStorage.removeItem('workoutPlan');
    await AsyncStorage.removeItem('streakData');
    await AsyncStorage.removeItem('userProfile');
    setProfile(null);
    setCurrentWorkout(null);
    setCompletedWorkout(null);
    setDashboardKey(0);
    setActiveTab('dashboard');
  };

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (!profile) {
    return <FadeScreen key="setup"><SetupScreen onSetupComplete={setProfile} /></FadeScreen>;
  }

  if (currentWorkout) {
    return (
      <FadeScreen key="workout">
        <WorkoutEngine
          workout={currentWorkout}
          onComplete={handleWorkoutComplete}
          onBack={() => setCurrentWorkout(null)}
        />
      </FadeScreen>
    );
  }

  if (completedWorkout) {
    return (
      <FadeScreen key="completion">
        <CompletionScreen
          workout={completedWorkout}
          streak={currentStreak}
          onBack={() => {
            setCompletedWorkout(null);
            setDashboardKey((k) => k + 1);
            setActiveTab('dashboard');
          }}
        />
      </FadeScreen>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'stats':
        return <StatsScreen key="stats" profile={profile} />;
      case 'profile':
        return <ProfileScreen key="profile" profile={profile} onProfileUpdate={setProfile} onReset={handleReset} />;
      default:
        return (
          <Dashboard
            key={dashboardKey}
            profile={profile}
            onStartWorkout={(workout) => setCurrentWorkout(workout)}
            onReset={handleReset}
          />
        );
    }
  };

  return (
    <FadeScreen key={activeTab}>
      <View style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
        {renderTab()}
        <BottomNav activeTab={activeTab} onTabPress={setActiveTab} />
      </View>
    </FadeScreen>
  );
}