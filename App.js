import React, { useState } from 'react';
import SetupScreen from './src/screens/SetupScreen';
import { generateWorkoutPlan } from './src/services/geminiService';

export default function App() {
  const [profile, setProfile] = useState(null);

  const handleSetupComplete = async (userProfile) => {
    setProfile(userProfile);
    const plan = await generateWorkoutPlan(userProfile, 1);
    console.log('PLANO GERADO:', JSON.stringify(plan, null, 2));
  };

  if (!profile) {
    return <SetupScreen onSetupComplete={handleSetupComplete} />;
  }

  return null;
}