import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { SettingsState } from '../types';
import { minutesBetween } from '../utils/date';
import { getNotificationBody } from '../utils/omerText';

const CHANNEL_NORMAL = 'omerlock-high';
const CHANNEL_ESCALATED = 'omerlock-max';
const CHANNEL_EXTREME = 'omerlock-max-persistent';

Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true
    } as Notifications.NotificationBehavior)
});

const buildChannelId = (level: number): string => {
  if (level >= 2) {
    return CHANNEL_EXTREME;
  }
  if (level === 1) {
    return CHANNEL_ESCALATED;
  }
  return CHANNEL_NORMAL;
};

const triggerFromDate = (
  date: Date,
  level: number
): Notifications.NotificationTriggerInput =>
  ({
  type: Notifications.SchedulableTriggerInputTypes.DATE,
  date,
  channelId: buildChannelId(level)
} as Notifications.NotificationTriggerInput);

const buildNotificationContent = (
  title: string,
  body: string,
  data: Record<string, unknown>
): Notifications.NotificationContentInput =>
  ({
    title,
    body,
    sound: 'default',
    priority: Notifications.AndroidNotificationPriority.MAX,
    ...(Platform.OS === 'android' ? { sticky: true, autoDismiss: false } : {}),
    data
  } as Notifications.NotificationContentInput);

const minutesUntilWindowEnd = 23 * 60;

export const initializeNotifications = async (): Promise<boolean> => {
  const perms = await Notifications.getPermissionsAsync();
  let granted = perms.granted;

  if (!granted) {
    const ask = await Notifications.requestPermissionsAsync();
    granted = ask.granted;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_NORMAL, {
      name: 'OmerLock High Priority',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 120, 300],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
      sound: 'default'
    });

    await Notifications.setNotificationChannelAsync(CHANNEL_ESCALATED, {
      name: 'OmerLock Escalated',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 120, 500, 120, 500],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
      sound: 'default'
    });

    await Notifications.setNotificationChannelAsync(CHANNEL_EXTREME, {
      name: 'OmerLock Persistent Escalation',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 800, 120, 800, 120, 800],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      sound: 'default'
    });
  }

  return granted;
};

export const clearPendingOmerNotifications = async (): Promise<void> => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const omer = scheduled.filter((entry) => {
    const data = entry.content.data as Record<string, unknown> | undefined;
    return data?.kind === 'omer_reminder' || data?.kind === 'omer_snooze';
  });

  await Promise.all(
    omer.map((entry) => Notifications.cancelScheduledNotificationAsync(entry.identifier))
  );
};

interface ReminderArgs {
  day: number;
  tzeit: Date;
  includeBracha: boolean;
  settings: SettingsState;
}

const buildReminderTimeline = (
  tzeit: Date,
  baseFrequency: number,
  escalationEnabled: boolean
): Array<{ date: Date; level: number }> => {
  const points: Array<{ date: Date; level: number }> = [];
  let cursor = new Date(tzeit);
  const end = new Date(tzeit.getTime() + minutesUntilWindowEnd * 60_000);

  while (cursor <= end) {
    const elapsed = minutesBetween(tzeit, cursor);
    const level = escalationEnabled ? (elapsed >= 90 ? 2 : elapsed >= 30 ? 1 : 0) : 0;

    points.push({ date: new Date(cursor), level });

    const gap =
      level === 0
        ? baseFrequency
        : level === 1
          ? Math.max(5, baseFrequency - 3)
          : Math.max(3, baseFrequency - 5);

    cursor = new Date(cursor.getTime() + gap * 60_000);
  }

  return points;
};

export const scheduleNightReminders = async ({
  day,
  tzeit,
  includeBracha,
  settings
}: ReminderArgs): Promise<void> => {
  await clearPendingOmerNotifications();

  const body = getNotificationBody(day, settings.nusach, includeBracha);
  const timeline = buildReminderTimeline(
    tzeit,
    settings.reminderBaseMinutes,
    settings.escalationEnabled
  );

  const now = Date.now();
  const futureTimeline = timeline.filter((step) => step.date.getTime() >= now);

  await Promise.all(
    futureTimeline.map((step) =>
      Notifications.scheduleNotificationAsync({
        content: buildNotificationContent("Tonight's Omer Count", body, {
          kind: 'omer_reminder',
          day,
          escalationLevel: step.level
        }),
        trigger: triggerFromDate(step.date, step.level)
      })
    )
  );
};

export const scheduleSnoozeReminder = async (
  day: number,
  minutes: number,
  settings: SettingsState,
  includeBracha: boolean
): Promise<void> => {
  const body = getNotificationBody(day, settings.nusach, includeBracha);
  const target = new Date(Date.now() + minutes * 60_000);

  await Notifications.scheduleNotificationAsync({
    content: buildNotificationContent('Snooze ended: Count Sefiras HaOmer', body, {
      kind: 'omer_snooze',
      day
    }),
    trigger: triggerFromDate(target, 2)
  });
};

export const addNotificationListeners = (
  onTap: () => void
): { remove: () => void } => {
  const responseSub = Notifications.addNotificationResponseReceivedListener(() => {
    onTap();
  });

  const receiveSub = Notifications.addNotificationReceivedListener(() => {
    onTap();
  });

  return {
    remove: () => {
      responseSub.remove();
      receiveSub.remove();
    }
  };
};
