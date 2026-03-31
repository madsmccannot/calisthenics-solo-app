import React, { useState } from 'react';
import SetupScreen from './src/screens/SetupScreen';
import Dashboard from './src/screens/Dashboard';
import WorkoutEngine from './src/screens/WorkoutEngine';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateStreak } from './src/services/localStore';

export default function App() {
  const [profile, setProfile] = useState(null);
  const [currentWorkout, setCurrentWorkout] = useState(null);
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
    await updateStreak();
    setCurrentWorkout(null);
    setDashboardKey((k) => k + 1);
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

  return (
    <Dashboard
      key={dashboardKey}
      profile={profile}
      onStartWorkout={(workout) => setCurrentWorkout(workout)}
    />
  );
}