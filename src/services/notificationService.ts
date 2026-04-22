import * as Notifications from 'expo-notifications';
import { Alert, Linking, Platform } from 'react-native';

import { SettingsState, LatLng } from '../types';
import { addDays, minutesBetween } from '../utils/date';
import { resolveZmanim } from './hebcalService';
import { getNotificationBody } from '../utils/omerText';

const CHANNEL_NORMAL = 'omerlock-high';
const CHANNEL_ESCALATED = 'omerlock-max';
const CHANNEL_EXTREME = 'omerlock-max-persistent';

// iOS hard limit: 64 scheduled local notifications total.
//
// Budget per scheduling cycle:
//  48   omer_future   — up to 48 nights × 1 reminder each, exactly at tzeit
//  15   omer_burst    — tonight's intensive burst (post-open)
//   1   omer_snooze   — reserved for snooze taps (burst clears when snoozed)
//  ─────
//  64   max total (only on night 1 of the Omer; always ≤ 63 during current season)
//
// Key design: one notification per remaining Omer night fires exactly at that
// night's nightfall. This covers the whole rest of the season from a single
// app open. First HEBCAL_NIGHTS nights use resolveZmanim() for location-accurate
// tzeit; beyond that, addDays copies tonight's clock time (off by ~2 min/day,
// refreshed whenever the app is opened again).

const BURST_LIMIT = 15;
const HEBCAL_NIGHTS = 5;

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
  if (level >= 2) return CHANNEL_EXTREME;
  if (level === 1) return CHANNEL_ESCALATED;
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
    data
  } as Notifications.NotificationContentInput);

const createAndroidChannels = async (): Promise<void> => {
  await Notifications.setNotificationChannelAsync(CHANNEL_NORMAL, {
    name: 'OmerLock Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 300, 120, 300],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    sound: 'default',
    enableLights: true,
    showBadge: true
  });

  await Notifications.setNotificationChannelAsync(CHANNEL_ESCALATED, {
    name: 'OmerLock Escalated',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 120, 500, 120, 500],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    sound: 'default',
    enableLights: true,
    showBadge: true
  });

  await Notifications.setNotificationChannelAsync(CHANNEL_EXTREME, {
    name: 'OmerLock Persistent',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 800, 120, 800, 120, 800],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
    sound: 'default',
    enableLights: true,
    showBadge: true
  });
};

// ─── Permissions ─────────────────────────────────────────────────────────────

export const initializeNotifications = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    await createAndroidChannels();
  }

  const perms = await Notifications.getPermissionsAsync();
  if (perms.granted) return true;
  if (!perms.canAskAgain) return false;

  const asked = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowCriticalAlerts: false,
      provideAppNotificationSettings: false,
      allowProvisional: false
    }
  });

  return asked.granted;
};

export const checkNotificationPermission = async (): Promise<boolean> => {
  const perms = await Notifications.getPermissionsAsync();
  return perms.granted;
};

export const showPermissionDeniedAlert = (): void => {
  Alert.alert(
    'Notifications Disabled',
    'OmerLock cannot remind you to count the Omer because notifications are turned off.\n\nTap "Open Settings", go to Notifications, and enable them for OmerLock.',
    [
      { text: 'Later', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() }
    ]
  );
};

// ─── Clear functions ──────────────────────────────────────────────────────────
//
//  clearBurstNotifications   → clears only tonight's burst + snooze
//                              Called when user counts. Does NOT touch omer_future
//                              or omer_daily_safety, so future nights keep firing.
//
//  clearAllOmerNotifications → clears absolutely everything.
//                              Called only when the Omer season ends or cycle resets.

export const clearBurstNotifications = async (): Promise<void> => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = scheduled.filter((entry) => {
    const kind = (entry.content.data as Record<string, unknown>)?.kind;
    return kind === 'omer_burst' || kind === 'omer_snooze';
  });
  await Promise.all(
    toCancel.map((e) => Notifications.cancelScheduledNotificationAsync(e.identifier))
  );
};

export const clearAllOmerNotifications = async (): Promise<void> => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = scheduled.filter((entry) => {
    const kind = (entry.content.data as Record<string, unknown>)?.kind;
    return (
      kind === 'omer_burst' ||
      kind === 'omer_snooze' ||
      kind === 'omer_future' ||
      kind === 'omer_daily_safety'
    );
  });
  await Promise.all(
    toCancel.map((e) => Notifications.cancelScheduledNotificationAsync(e.identifier))
  );
};

// Legacy alias used elsewhere
export const clearPendingOmerNotifications = clearAllOmerNotifications;

// ─── Scheduling ───────────────────────────────────────────────────────────────

interface ReminderArgs {
  day: number;
  tzeit: Date;
  includeBracha: boolean;
  settings: SettingsState;
  coords?: LatLng;
}

const buildBurstTimeline = (
  tzeit: Date,
  baseFrequency: number,
  escalationEnabled: boolean,
  hardcoreMode: boolean
): Array<{ date: Date; level: number }> => {
  const points: Array<{ date: Date; level: number }> = [];
  let cursor = new Date(tzeit);

  while (points.length < BURST_LIMIT) {
    const elapsed = minutesBetween(tzeit, cursor);
    const level = escalationEnabled ? (elapsed >= 90 ? 2 : elapsed >= 30 ? 1 : 0) : 0;
    points.push({ date: new Date(cursor), level });

    const gap = hardcoreMode
      ? 5
      : level === 0
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
  settings,
  coords
}: ReminderArgs): Promise<void> => {
  const granted = await checkNotificationPermission();
  if (!granted) return;

  await clearAllOmerNotifications();

  const now = Date.now();

  // ── Future nights ─────────────────────────────────────────────────────
  // One notification per remaining Omer night, fired exactly at that night's
  // nightfall. Scheduling all remaining nights in one pass means the user only
  // needs to open the app once and reminders cover the rest of the season.
  //
  // First HEBCAL_NIGHTS nights: resolveZmanim() for location-accurate tzeit.
  // Beyond that: addDays copies tonight's clock time (~2 min/day drift, but
  // refreshed to accurate times whenever the app opens again).
  const futureNights = Math.min(49 - day, 48);

  for (let n = 1; n <= futureNights; n++) {
    const futureDay = day + n;
    const futureDate = addDays(tzeit, n);

    let futureTzeit: Date;
    if (n <= HEBCAL_NIGHTS) {
      try {
        const zmanim = await resolveZmanim(futureDate, settings.fallbackTzeit, coords);
        futureTzeit = zmanim.tzeit;
      } catch {
        futureTzeit = futureDate;
      }
    } else {
      futureTzeit = futureDate;
    }

    const fireAt = new Date(futureTzeit.getTime());
    if (fireAt.getTime() <= now) continue;

    const futureBody = getNotificationBody(
      futureDay,
      settings.nusach,
      false,
      settings.omerPreposition
    );

    await Notifications.scheduleNotificationAsync({
      content: buildNotificationContent(
        `🕯️ Count the Omer — Night ${futureDay}`,
        futureBody,
        { kind: 'omer_future', day: futureDay, offsetMin: 0 }
      ),
      trigger: triggerFromDate(fireAt, 0)
    });
  }

  // ── Tonight's burst ────────────────────────────────────────────────────
  // Intensive reminders for tonight only. These fire after the app is opened
  // (since that's when this function runs), which means they land on top of
  // whatever future reminders existed. They clear on count.
  const body = getNotificationBody(
    day,
    settings.nusach,
    includeBracha,
    settings.omerPreposition
  );
  const burstTimeline = buildBurstTimeline(
    tzeit,
    settings.reminderBaseMinutes,
    settings.escalationEnabled,
    settings.hardcoreMode
  );

  const futureSlots = burstTimeline.filter((step) => step.date.getTime() > now);

  await Promise.all(
    futureSlots.map((step) =>
      Notifications.scheduleNotificationAsync({
        content: buildNotificationContent('🕯️ Count the Omer', body, {
          kind: 'omer_burst',
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
  const granted = await checkNotificationPermission();
  if (!granted) return;

  const body = getNotificationBody(
    day,
    settings.nusach,
    includeBracha,
    settings.omerPreposition
  );
  const target = new Date(Date.now() + minutes * 60_000);

  await Notifications.scheduleNotificationAsync({
    content: buildNotificationContent('⏰ Snooze ended — Count the Omer', body, {
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
