import React, { useState, useRef, useEffect } from 'react';
import { Animated, View, TouchableOpacity, Text, StyleSheet, ActivityIndicator, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SetupScreen from './src/screens/SetupScreen';
import Dashboard from './src/screens/Dashboard';
import WorkoutEngine from './src/screens/WorkoutEngine';
import CompletionScreen from './src/screens/CompletionScreen';
import SplashScreen from './src/screens/SplashScreen';
import StatsScreen from './src/screens/StatsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import FeedScreen from './src/screens/FeedScreen';
import AuthScreen from './src/screens/AuthScreen';
import UsernameScreen from './src/screens/UsernameScreen';
import LanguageScreen from './src/screens/LanguageScreen';
import { useI18n } from './src/i18n/I18nContext';
import { supabaseEnabled } from './src/services/supabase';
import { getSession, onAuthChange, signOut } from './src/services/auth';
import { setSyncUser, freshAuthSync, flushSync, resetCloud, getDisplayName } from './src/services/cloudSync';
import { updateStreak, getWeightLog } from './src/services/localStore';
import { completeWorkout, checkMedals, getSeason, advanceSeason, logFeedEvent } from './src/services/progressStore';
import { xpBreakdown, COMPLETION_BONUS } from './src/config/xpTable';
import { BackHandler } from 'react-native';

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
  const { t } = useI18n();
  const tabs = [
    { key: 'dashboard', emoji: '🏠', label: t('tabs.plan') },
    { key: 'feed', emoji: '📣', label: t('tabs.feed') },
    { key: 'stats', emoji: '📊', label: t('tabs.stats') },
    { key: 'profile', emoji: '👤', label: t('tabs.profile') },
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
  const [xpResult, setXpResult] = useState(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [dashboardKey, setDashboardKey] = useState(0);
  const [activeTab, setActiveTab] = useState('dashboard');
  const { t, chosen } = useI18n();
  // undefined = ainda a verificar; null = sem sessão; objeto = com sessão
  const [session, setSession] = useState(supabaseEnabled ? undefined : null);
  const [syncing, setSyncing] = useState(false);
  const [username, setUsername] = useState(null); // nome de utilizador (null = ainda não escolhido)

  useEffect(() => {
    loadProfile();
  }, []);

  // Restauro de sessão (app reaberta): fixa o utilizador, NÃO toca no local
  // (offline-first). O login/registo são tratados em handleFreshAuth.
  useEffect(() => {
    if (!supabaseEnabled) return;
    getSession().then(async (s) => {
      setSyncUser(s?.user?.id || null);
      if (s) setUsername(await getDisplayName());
      setSession(s);
    });
    // reage a logout (e refresh) — não sincroniza aqui
    const unsub = onAuthChange((s) => {
      if (!s) {
        setSyncUser(null);
        setSession(null);
      }
    });
    return unsub;
  }, []);

  // Ao mandar a app para segundo plano, empurra o estado para a nuvem.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') flushSync();
    });
    return () => sub.remove();
  }, []);

  // Chamado pelo AuthScreen quando o utilizador entra/regista (auth fresca).
  const handleFreshAuth = async (newSession, isNew) => {
    const uid = newSession?.user?.id;
    setSyncUser(uid);
    setSyncing(true);
    setSession(newSession);
    await freshAuthSync(uid, isNew); // limpa local + (login: puxa | registo: vazio)
    await loadProfile();
    setUsername(await getDisplayName()); // registo -> null (pede nome); login -> nome da conta
    setDashboardKey((k) => k + 1);
    setSyncing(false);
  };

  const handleUsernameDone = (name) => {
    setUsername(name);
  };

  const handleSignOut = async () => {
    await flushSync();
    await signOut();
    setSyncUser(null);
    setSession(null);
    setUsername(null);
  };

  useEffect(() => {
    const backAction = () => {
      if (activeTab !== 'dashboard') {
        setActiveTab('dashboard');
        return true; // intercepta o botão
      }
      return false; // deixa sair da app
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [activeTab]);

  const loadProfile = async () => {
    const saved = await AsyncStorage.getItem('userProfile');
    setProfile(saved ? JSON.parse(saved) : null); // repõe a null se não houver
  };

  const handleWorkoutComplete = async () => {
    let seasonComplete = false;
    const saved = await AsyncStorage.getItem('workoutPlan');
    if (saved) {
      const plan = JSON.parse(saved);
      const updated = plan.map((day) =>
        day.day_number === currentWorkout.day_number
          ? { ...day, completed: true }
          : day
      );
      await AsyncStorage.setItem('workoutPlan', JSON.stringify(updated));
      // season completa quando não sobram dias de treino (ignora recuperação)
      const remaining = updated.filter(
        (d) => !d.completed && d.workout_type !== 'Recovery'
      ).length;
      seasonComplete = remaining === 0;
    }
    const streakData = await updateStreak();

    // Progressão: calcula e credita o XP do treino
    const className = profile.level || 'Iniciante';
    const workoutExercises = currentWorkout.exercises || [];
    const breakdown = xpBreakdown(workoutExercises, className);
    const exercisesXp = breakdown.reduce((a, b) => a + b.xp, 0);
    const reps = workoutExercises
      .filter((e) => e.type === 'reps')
      .reduce((a, e) => a + (Number(e.quantity) || 0), 0);
    const seconds = workoutExercises
      .filter((e) => e.type !== 'reps')
      .reduce((a, e) => a + (Number(e.quantity) || 0), 0);

    // reps por id de exercício (para as medalhas: "1000 flexões", etc.)
    const repsById = workoutExercises
      .filter((e) => e.type === 'reps')
      .reduce((acc, e) => {
        acc[e.id] = (acc[e.id] || 0) + (Number(e.quantity) || 0);
        return acc;
      }, {});

    const result = await completeWorkout({
      exercisesXp,
      bonus: COMPLETION_BONUS,
      streak: streakData.current,
      exerciseCount: workoutExercises.length,
      reps,
      seconds,
      repsById,
    });

    // medalhas desbloqueadas com este treino
    const weightLog = await getWeightLog();
    const newMedals = await checkMedals({ streak: streakData, weightLog });

    const season = await getSeason();

    // marcos para o Feed (medalhas já são registadas dentro do checkMedals)
    await logFeedEvent({ emoji: '💪', title: `Completaste o Dia ${currentWorkout.day_number}`, subtitle: `+${result.total} XP` });
    if (result.leveledUp) {
      await logFeedEvent({ emoji: '⭐', title: `Subiste ao nível ${result.toLevel}`, subtitle: result.title });
    }
    if ([7, 14, 30, 50, 100].includes(streakData.current)) {
      await logFeedEvent({ emoji: '🔥', title: `${streakData.current} dias seguidos` });
    }
    if (seasonComplete) {
      await logFeedEvent({ emoji: '🏆', title: `Season ${season} completa!` });
    }

    setXpResult({ ...result, breakdown, newMedals, seasonComplete, season });
    setCurrentStreak(streakData.current);
    setCompletedWorkout(currentWorkout);
    setCurrentWorkout(null);
  };

  // Avança para a próxima season: gera um plano novo (mais difícil) ancorado a
  // hoje. NÃO mexe na streak nem no XP/moedas/medalhas — só o plano é renovado.
  const handleStartNextSeason = async () => {
    await AsyncStorage.removeItem('workoutPlan');
    await advanceSeason();
    setCompletedWorkout(null);
    setXpResult(null);
    setDashboardKey((k) => k + 1);
    setActiveTab('dashboard');
  };

  const handleReset = async () => {
    await resetCloud(); // limpa também a nuvem se houver conta ligada
    await AsyncStorage.removeItem('workoutPlan');
    await AsyncStorage.removeItem('streakData');
    await AsyncStorage.removeItem('userProfile');
    await AsyncStorage.removeItem('gameState');
    await AsyncStorage.removeItem('planClass');
    await AsyncStorage.removeItem('weightLog');
    setProfile(null);
    setCurrentWorkout(null);
    setCompletedWorkout(null);
    setDashboardKey(0);
    setActiveTab('dashboard');
  };

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // First run: pick a language before anything else
  if (!chosen) {
    return <LanguageScreen />;
  }

  // Verificação da sessão (Supabase configurado)
  if (supabaseEnabled && session === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4ade80" />
      </View>
    );
  }
  if (supabaseEnabled && !session) {
    return <AuthScreen onAuthed={handleFreshAuth} />;
  }

  if (supabaseEnabled && syncing) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4ade80" />
        <Text style={{ color: '#aaaaaa', marginTop: 16 }}>{t('common.syncing')}</Text>
      </View>
    );
  }

  // Conta criada mas ainda sem nome de utilizador -> pede o nome
  if (supabaseEnabled && session && !username) {
    return <UsernameScreen onDone={handleUsernameDone} />;
  }

  if (!profile) {
    return (
      <FadeScreen>
        <SetupScreen onSetupComplete={setProfile} />
      </FadeScreen>
    );
  }

  if (currentWorkout) {
    return (
      <WorkoutEngine
        workout={currentWorkout}
        className={profile.level}
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
        xpResult={xpResult}
        onStartNextSeason={handleStartNextSeason}
        onBack={() => {
          setCompletedWorkout(null);
          setXpResult(null);
          setDashboardKey((k) => k + 1);
          setActiveTab('dashboard');
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
      <View style={{ flex: 1, display: activeTab === 'dashboard' ? 'flex' : 'none' }}>
        <Dashboard
          key={dashboardKey}
          profile={profile}
          onStartWorkout={(workout) => setCurrentWorkout(workout)}
          onReset={handleReset}
        />
      </View>
      <View style={{ flex: 1, display: activeTab === 'feed' ? 'flex' : 'none' }}>
        <FeedScreen activeTab={activeTab} />
      </View>
      <View style={{ flex: 1, display: activeTab === 'stats' ? 'flex' : 'none' }}>
        <StatsScreen profile={profile} activeTab={activeTab} />
      </View>
      <View style={{ flex: 1, display: activeTab === 'profile' ? 'flex' : 'none' }}>
        <ProfileScreen
          profile={profile}
          activeTab={activeTab}
          email={session?.user?.email}
          onProfileUpdate={setProfile}
          onReset={handleReset}
          onPlanChanged={() => setDashboardKey((k) => k + 1)}
          onSignOut={supabaseEnabled ? handleSignOut : null}
        />
      </View>
      <BottomNav activeTab={activeTab} onTabPress={setActiveTab} />
    </View>
  );
}