import React, { useState } from 'react';
import SetupScreen from './src/screens/SetupScreen';
import Dashboard from './src/screens/Dashboard';
import WorkoutEngine from './src/screens/WorkoutEngine';
import CompletionScreen from './src/screens/CompletionScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateStreak, getStreakData } from './src/services/localStore';

export default function App() {
  const [profile, setProfile] = useState(null);
  const [currentWorkout, setCurrentWorkout] = useState(null);
  const [completedWorkout, setCompletedWorkout] = useState(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [dashboardKey, setDashboardKey] = useState(0);

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

  const handleReset = () => {
    setProfile(null);
    setCurrentWorkout(null);
    setCompletedWorkout(null);
    setDashboardKey(0);
  };

  if (!profile) {
    return <SetupScreen onSetupComplete={setProfile} />;
  }

  if (currentWorkout) {
    return (
      <WorkoutEngine
        workout={currentWorkout}
        onComplete={handleWorkoutComplete}
        onBack={() => setCurrentWorkout(null)}
      />
    );
  }

  if (completedWorkout) {
    return (
      <CompletionScreen
        workout={completedWorkout}
        streak={currentStreak}
        onBack={() => {
          setCompletedWorkout(null);
          setDashboardKey((k) => k + 1);
        }}
      />
    );
  }

  return (
    <Dashboard
      key={dashboardKey}
      profile={profile}
      onStartWorkout={(workout) => setCurrentWorkout(workout)}
      onReset={handleReset}
    />
  );
}