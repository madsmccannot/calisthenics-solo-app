import React from 'react';
import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';

const animationMap = {
  'pushup.json': require('../../assets/animations/pushup.json'),
  'squat.json': require('../../assets/animations/squat.json'),
  'burpee.json': require('../../assets/animations/burpee.json'),
  'plank.json': require('../../assets/animations/plank.json'),
  'mountain_climber.json': require('../../assets/animations/mountain_climber.json'),
  'jumping_jack.json': require('../../assets/animations/jumping_jack.json'),
  'lunge.json': require('../../assets/animations/lunge.json'),
  'superman.json': require('../../assets/animations/superman.json'),
  'leg_raise.json': require('../../assets/animations/leg_raise.json'),
};

export default function AnimationPlayer({ animationFile }) {
  const source = animationMap[animationFile] || animationMap['plank.json'];

  return (
    <View style={styles.container}>
      <LottieView
        source={source}
        autoPlay
        loop
        style={styles.animation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 220, height: 220,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#1e1e1e', borderRadius: 20,
    marginBottom: 16, borderWidth: 1, borderColor: '#333'
  },
  animation: { width: 200, height: 200 },
});