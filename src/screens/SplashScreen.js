import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

export default function SplashScreen({ onFinish }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 800, useNativeDriver: true
      }),
      Animated.spring(scaleAnim, {
        toValue: 1, friction: 4, tension: 40, useNativeDriver: true
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0, duration: 500, useNativeDriver: true
      }).start(() => onFinish());
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, {
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }]
      }]}>
        <Text style={styles.emoji}>💪</Text>
        <Text style={styles.title}>Calisthenics</Text>
        <Text style={styles.subtitle}>SOLO</Text>
        <Text style={styles.tagline}>30 dias. Sem equipamento.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0f0f0f',
    justifyContent: 'center', alignItems: 'center'
  },
  content: { alignItems: 'center' },
  emoji: { fontSize: 72, marginBottom: 16 },
  title: {
    fontSize: 36, fontWeight: 'bold', color: '#ffffff',
    letterSpacing: 4, textTransform: 'uppercase'
  },
  subtitle: {
    fontSize: 48, fontWeight: 'bold', color: '#4ade80',
    letterSpacing: 12, textTransform: 'uppercase', marginTop: -8
  },
  tagline: { color: '#aaaaaa', fontSize: 16, marginTop: 16, letterSpacing: 2 },
});