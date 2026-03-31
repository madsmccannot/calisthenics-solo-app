import React, { useState } from 'react';
import SetupScreen from './src/screens/SetupScreen';
import Dashboard from './src/screens/Dashboard';

export default function App() {
  const [profile, setProfile] = useState(null);
  const [currentWorkout, setCurrentWorkout] = useState(null);

  if (!profile) {
    return <SetupScreen onSetupComplete={setProfile} />;
  }

  return (
    <Dashboard
      profile={profile}
      onStartWorkout={(workout) => setCurrentWorkout(workout)}
    />
  );
}