import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestPermissions() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleDailyReminder(hour = 19, minute = 0) {
  // Cancela qualquer notificação anterior para não duplicar
  await Notifications.cancelAllScheduledNotificationsAsync();

  const granted = await requestPermissions();
  if (!granted) return false;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '💪 Hora de treinar!',
      body: 'Não quebres o teu streak. O teu treino de hoje está à tua espera.',
      sound: true,
    },
    trigger: {
      hour,
      minute,
      repeats: true,
    },
  });

  return true;
}

export async function cancelReminder() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}