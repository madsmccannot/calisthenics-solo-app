
import { createAudioPlayer } from 'expo-audio';

const BEEP_SOURCE =
  'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';

export function playBeep() {
  let player;
  let subscription;

  try {
    player = createAudioPlayer(BEEP_SOURCE, {
      updateInterval: 100,
    });

    subscription = player.addListener(
      'playbackStatusUpdate',
      (status) => {
        if (status.didJustFinish || status.error) {
          subscription?.remove();
          player.release();
        }
      }
    );

    player.play();
  } catch (error) {
    subscription?.remove();
    player?.release();
    console.warn('Error playing beep:', error);
  }
}
