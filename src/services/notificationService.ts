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
//  42   omer_future        — up to 42 future nights × 1 nightfall reminder each
//  15   omer_burst         — tonight's burst (capped at 2am, so chill mode uses fewer)
//   6   omer_morning_catchup — tomorrow 7am–12pm if not counted (cancelled on count)
//   1   omer_snooze        — reserved for snooze taps
//  ─────
//  64   max (night 1 with hardcore mode and morning catch-up both on)
//
// If morningCatchupEnabled is off, future nights limit can be raised to 48.
// Future nights use the tzeit cache when available (accurate for all 49 nights);
// falls back to addDays for uncached nights (~2 min/day drift, refreshed on app open).

const BURST_LIMIT = 15;
// Any burst reminder scheduled for after this hour is suppressed.
// Prevents chill-mode (60-min) reminders from bleeding into the morning.
const BURST_END_HOUR = 2; // 2am

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
//  clearBurstNotifications   → clears tonight's burst, snooze, and morning catch-up.
//                              Called when user counts. Does NOT touch omer_future
//                              so future nights keep firing.
//
//  clearAllOmerNotifications → clears absolutely everything.
//                              Called only when the Omer season ends or cycle resets.

export const clearBurstNotifications = async (): Promise<void> => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = scheduled.filter((entry) => {
    const kind = (entry.content.data as Record<string, unknown>)?.kind;
    return (
      kind === 'omer_burst' ||
      kind === 'omer_snooze' ||
      kind === 'omer_morning_catchup'
    );
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
      kind === 'omer_morning_catchup' ||
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
  tzeitTimes?: Record<number, string>; // season cache: day → ISO timestamp
}

// Builds burst timeline from nightfall until 2am.
// Both hardcore and chill use reminderBaseMinutes — the mode difference is
// just the interval (10 min vs 60 min) set in settings.
const buildBurstTimeline = (
  tzeit: Date,
  baseFrequency: number,
  escalationEnabled: boolean
): Array<{ date: Date; level: number }> => {
  const points: Array<{ date: Date; level: number }> = [];
  let cursor = new Date(tzeit);

  // 2am on the morning after tzeit
  const burstCutoff = new Date(tzeit);
  burstCutoff.setDate(burstCutoff.getDate() + 1);
  burstCutoff.setHours(BURST_END_HOUR, 0, 0, 0);

  while (points.length < BURST_LIMIT && cursor < burstCutoff) {
    const elapsed = minutesBetween(tzeit, cursor);
    const level = escalationEnabled ? (elapsed >= 90 ? 2 : elapsed >= 30 ? 1 : 0) : 0;
    points.push({ date: new Date(cursor), level });

    const gap = level === 0
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
  coords,
  tzeitTimes
}: ReminderArgs): Promise<void> => {
  const granted = await checkNotificationPermission();
  if (!granted) return;

  await clearAllOmerNotifications();

  const now = Date.now();

  // ── Budget ─────────────────────────────────────────────────────────────────
  // 42 future + 15 burst + 6 morning catch-up + 1 snooze = 64 (iOS max)
  // When morningCatchupEnabled is off: 48 future + 15 burst + 1 snooze = 64
  const futureNightsCap = settings.morningCatchupEnabled ? 42 : 48;
  const futureNights = Math.min(49 - day, futureNightsCap);

  // ── Future nights ─────────────────────────────────────────────────────────
  // One nightfall reminder per remaining night. Uses tzeit cache for accuracy
  // across the whole season; falls back to addDays for uncached nights.
  for (let n = 1; n <= futureNights; n++) {
    const futureDay = day + n;
    const futureDate = addDays(tzeit, n);

    let futureTzeit: Date;
    const cached = tzeitTimes?.[futureDay];
    if (cached) {
      futureTzeit = new Date(cached);
    } else {
      try {
        const zmanim = await resolveZmanim(futureDate, settings.fallbackTzeit, coords);
        futureTzeit = zmanim.tzeit;
      } catch {
        futureTzeit = futureDate;
      }
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

  // ── Tonight's burst ────────────────────────────────────────────────────────
  // Intensive reminders starting at nightfall, capped at 2am.
  const body = getNotificationBody(
    day,
    settings.nusach,
    includeBracha,
    settings.omerPreposition
  );
  const burstTimeline = buildBurstTimeline(
    tzeit,
    settings.reminderBaseMinutes,
    settings.escalationEnabled
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

  // ── Morning catch-up ───────────────────────────────────────────────────────
  // If the user doesn't count tonight, hourly reminders fire the next morning
  // (7am–12pm) prompting them to count without a bracha. Pre-scheduled here
  // and cancelled at count time via clearBurstNotifications.
  if (settings.morningCatchupEnabled) {
    const catchupBody = getNotificationBody(
      day,
      settings.nusach,
      false, // no bracha for daytime catch-up
      settings.omerPreposition
    );

    // Next civil morning: take tzeit's date, advance one day, set hours 7–12
    const nextMorningBase = new Date(tzeit);
    nextMorningBase.setDate(nextMorningBase.getDate() + 1);
    nextMorningBase.setSeconds(0, 0);

    const morningHours = [7, 8, 9, 10, 11, 12];
    await Promise.all(
      morningHours.map((hour) => {
        const fireAt = new Date(nextMorningBase);
        fireAt.setHours(hour, 0, 0, 0);
        if (fireAt.getTime() <= now) return Promise.resolve();
        return Notifications.scheduleNotificationAsync({
          content: buildNotificationContent(
            `☀️ Still need to count — Night ${day}`,
            `Count last night without a bracha.\n${catchupBody}`,
            { kind: 'omer_morning_catchup', day }
          ),
          trigger: triggerFromDate(fireAt, 0)
        });
      })
    );
  }
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
