import { Audio } from 'expo-av';

let sound = null;

export async function playBeep() {
  try {
    if (sound) {
      await sound.unloadAsync();
    }
    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
      { shouldPlay: true }
    );
    sound = newSound;
  } catch (e) {
    console.log('Erro no beep:', e);
  }
}