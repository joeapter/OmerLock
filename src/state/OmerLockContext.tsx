import React, {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import { makeDefaultState } from '../constants/defaults';
import {
  checkNotificationPermission,
  clearAllOmerNotifications,
  clearBurstNotifications,
  clearPendingOmerNotifications,
  initializeNotifications,
  scheduleNightReminders,
  scheduleSnoozeReminder,
  showPermissionDeniedAlert
} from '../services/notificationService';
import { computeRuntime, getCycleKey } from '../services/omerEngine';
import { prewarmLocationCache } from '../services/locationService';
import { loadState, saveState } from '../services/storageService';
import { syncPendingEvents, syncSnapshot } from '../services/syncService';
import { markPushTokenCounted, syncPushToken } from '../services/pushTokenService';
import {
  CompletionMethod,
  OmerCycleState,
  OmerLockContextValue,
  OmerRuntime,
  SettingsState,
  SyncEvent
} from '../types';

const emptyRuntime: OmerRuntime = {
  inSefira: false,
  activeDay: null,
  cycleKey: getCycleKey(new Date()),
  activeDateKey: '',
  tzeitToday: null,
  nextTzeit: null,
  nowAfterTzeit: false,
  countWindow: 'last_night',
  tzeitSource: 'fallback'
};

const OmerLockContext = createContext<OmerLockContextValue | undefined>(undefined);

const makeSyncEvent = (
  type: SyncEvent['type'],
  payload: Record<string, unknown>
): SyncEvent => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  type,
  payload,
  createdAt: new Date().toISOString()
});

const withQueuedEvent = (
  state: OmerCycleState,
  event: SyncEvent
): OmerCycleState => ({
  ...state,
  pendingSyncEvents: [...state.pendingSyncEvents.slice(-199), event]
});

const calculateStreak = (completions: OmerCycleState['completions']): number => {
  const sorted = Object.keys(completions)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (sorted.length === 0) {
    return 0;
  }

  let streak = 1;
  for (let idx = sorted.length - 1; idx > 0; idx -= 1) {
    const current = sorted[idx];
    const previous = sorted[idx - 1];
    if (current === undefined || previous === undefined) {
      break;
    }

    if (current - previous === 1) {
      streak += 1;
      continue;
    }
    break;
  }

  return streak;
};

const applyHalachicDerivations = (
  state: OmerCycleState,
  _runtime: OmerRuntime
): OmerCycleState => {
  // Halachic status is user-driven only:
  // assume prior days were counted unless user explicitly marks a missed day.
  const missedDays: number[] = [];
  const missedFullDay = state.overrideMissedEarlier;
  const streak = calculateStreak(state.completions);

  return {
    ...state,
    missedDays,
    missedFullDay,
    streak
  };
};

const applySettingPatch = (
  settings: SettingsState,
  patch: Partial<SettingsState>
): SettingsState => {
  const merged = {
    ...settings,
    ...patch
  };

  const reminder = Number(merged.reminderBaseMinutes);
  const safeReminder = Number.isFinite(reminder) ? Math.min(30, Math.max(3, reminder)) : 10;

  const snooze =
    merged.defaultSnoozeMinutes === 10 ||
    merged.defaultSnoozeMinutes === 20 ||
    merged.defaultSnoozeMinutes === 30
      ? merged.defaultSnoozeMinutes
      : 10;

  return {
    ...merged,
    reminderBaseMinutes: safeReminder,
    defaultSnoozeMinutes: snooze
  };
};

const arraysEqual = (a: number[], b: number[]): boolean =>
  a.length === b.length && a.every((value, idx) => value === b[idx]);

export const OmerLockProvider = ({ children }: PropsWithChildren) => {
  const [state, setState] = useState<OmerCycleState>(() =>
    makeDefaultState(getCycleKey(new Date()))
  );
  const [runtime, setRuntime] = useState<OmerRuntime>(emptyRuntime);
  const [loading, setLoading] = useState(true);

  const stateRef = useRef(state);
  const runtimeRef = useRef(runtime);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    runtimeRef.current = runtime;
  }, [runtime]);

  const commitState = useCallback(async (nextState: OmerCycleState) => {
    const stamped = {
      ...nextState,
      updatedAt: new Date().toISOString()
    };

    stateRef.current = stamped;
    setState(stamped);
    await saveState(stamped);

    const remaining = await syncPendingEvents(stamped.cycleKey, stamped.pendingSyncEvents);
    const pendingChanged = remaining.length !== stamped.pendingSyncEvents.length;

    const synced = pendingChanged
      ? {
          ...stamped,
          pendingSyncEvents: remaining,
          updatedAt: new Date().toISOString()
        }
      : stamped;

    if (pendingChanged) {
      stateRef.current = synced;
      setState(synced);
      await saveState(synced);
    }

    await syncSnapshot(synced);
  }, []);

  const refreshRuntime = useCallback(async () => {
    const currentState = stateRef.current;
    const computed = await computeRuntime(
      currentState.settings,
      currentState.lastKnownCoords
    );

    runtimeRef.current = computed.runtime;
    setRuntime(computed.runtime);

    let nextState = currentState;
    let changed = false;

    if (currentState.cycleKey !== computed.cycleKey) {
      nextState = {
        ...makeDefaultState(computed.cycleKey),
        settings: currentState.settings,
        pendingSyncEvents: currentState.pendingSyncEvents,
        lastKnownCoords: computed.resolvedCoords ?? currentState.lastKnownCoords
      };
      changed = true;
    } else if (
      computed.resolvedCoords &&
      (!currentState.lastKnownCoords ||
        currentState.lastKnownCoords.latitude !== computed.resolvedCoords.latitude ||
        currentState.lastKnownCoords.longitude !== computed.resolvedCoords.longitude)
    ) {
      nextState = {
        ...nextState,
        lastKnownCoords: computed.resolvedCoords
      };
      changed = true;
    }

    const derived = applyHalachicDerivations(nextState, computed.runtime);
    if (
      derived.missedFullDay !== currentState.missedFullDay ||
      derived.streak !== currentState.streak ||
      !arraysEqual(derived.missedDays, currentState.missedDays) ||
      changed
    ) {
      await commitState(derived);
    }
  }, [commitState]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const bootstrapCycle = getCycleKey(new Date());
        const persisted = await loadState(bootstrapCycle);

        // Pre-warm the in-memory location cache from persisted coords so the
        // GPS doesn't fire immediately on every app open.
        if (persisted.lastKnownCoords) {
          prewarmLocationCache(persisted.lastKnownCoords);
        }
        const notifGranted = await initializeNotifications();
        if (!notifGranted) {
          // Delay slightly so the main screen is visible before the alert appears
          setTimeout(showPermissionDeniedAlert, 1200);
        }

        if (cancelled) {
          return;
        }

        stateRef.current = persisted;
        setState(persisted);

        const computed = await computeRuntime(
          persisted.settings,
          persisted.lastKnownCoords
        );

        if (cancelled) {
          return;
        }

        runtimeRef.current = computed.runtime;
        setRuntime(computed.runtime);

        const adjusted =
          persisted.cycleKey !== computed.cycleKey
            ? {
                ...makeDefaultState(computed.cycleKey),
                settings: persisted.settings,
                pendingSyncEvents: persisted.pendingSyncEvents,
                lastKnownCoords: computed.resolvedCoords ?? persisted.lastKnownCoords
              }
            : {
                ...persisted,
                lastKnownCoords: computed.resolvedCoords ?? persisted.lastKnownCoords
              };

        const derived = applyHalachicDerivations(adjusted, computed.runtime);
        await commitState(derived);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [commitState]);

  useEffect(() => {
    if (loading) {
      return;
    }

    const interval = setInterval(() => {
      refreshRuntime().catch(() => undefined);
    }, 60_000);

    return () => clearInterval(interval);
  }, [loading, refreshRuntime]);

  const isTodayCompleted =
    runtime.activeDay !== null ? Boolean(state.completions[String(runtime.activeDay)]) : false;

  const brachaAllowed = state.settings.showBracha && !state.missedFullDay;

  const shouldShowLockModal = useMemo(() => {
    if (!runtime.inSefira || runtime.activeDay === null || isTodayCompleted) {
      return false;
    }

    if (state.settings.hardcoreMode) {
      return true;
    }

    if (!state.snoozeUntil) {
      return true;
    }

    const snoozeDeadline = new Date(state.snoozeUntil).getTime();
    if (!Number.isFinite(snoozeDeadline)) {
      return true;
    }

    return Date.now() >= snoozeDeadline;
  }, [
    runtime.activeDay,
    runtime.inSefira,
    isTodayCompleted,
    state.settings.hardcoreMode,
    state.snoozeUntil
  ]);

  const tzeitTimestamp = runtime.tzeitToday?.getTime() ?? 0;

  useEffect(() => {
    if (!runtime.inSefira || runtime.activeDay === null || !runtime.tzeitToday) {
      // Season over — kill everything including the daily safety trigger
      clearAllOmerNotifications().catch(() => undefined);
      return;
    }

    if (isTodayCompleted) {
      // Tonight is done — clear the burst but KEEP the daily safety so
      // it fires again tomorrow night without needing the app to be opened
      clearBurstNotifications().catch(() => undefined);
      return;
    }

    scheduleNightReminders({
      day: runtime.activeDay,
      tzeit: runtime.tzeitToday,
      includeBracha: brachaAllowed,
      settings: state.settings
    }).catch(() => undefined);

    // Register/refresh this device in Supabase so the hourly server-side cron
    // knows to push at nightfall even when the app is closed.
    syncPushToken(
      runtime.activeDay,
      runtime.tzeitToday,
      runtime.cycleKey,
      isTodayCompleted
    ).catch(() => undefined);
  }, [
    runtime.inSefira,
    runtime.activeDay,
    runtime.activeDateKey,
    tzeitTimestamp,
    brachaAllowed,
    isTodayCompleted,
    state.settings
  ]);

  const markDayCompleted = useCallback(
    async (method: CompletionMethod) => {
      const currentRuntime = runtimeRef.current;
      const currentState = stateRef.current;

      if (!currentRuntime.inSefira || currentRuntime.activeDay === null) {
        return;
      }

      const dayKey = String(currentRuntime.activeDay);
      const nextBase: OmerCycleState = {
        ...currentState,
        snoozeUntil: undefined,
        completions: {
          ...currentState.completions,
          [dayKey]: {
            day: currentRuntime.activeDay,
            method,
            timestamp: new Date().toISOString()
          }
        }
      };

      const derived = applyHalachicDerivations(nextBase, currentRuntime);
      const withEvent = withQueuedEvent(
        derived,
        makeSyncEvent('completion', { day: currentRuntime.activeDay, method })
      );

      await commitState(withEvent);
      // Keep the daily safety trigger alive — it will remind the user tomorrow night.
      // Only clear tonight's intensive burst.
      await clearBurstNotifications();
      // Tell the server immediately so the next hourly cron skips this device.
      markPushTokenCounted().catch(() => undefined);
    },
    [commitState]
  );

  const markAlreadyCounted = useCallback(
    async () => markDayCompleted('already_counted'),
    [markDayCompleted]
  );

  const markPastDaysAsDone = useCallback(async () => {
    const currentRuntime = runtimeRef.current;
    const currentState = stateRef.current;

    if (!currentRuntime.inSefira || currentRuntime.activeDay === null || currentRuntime.activeDay <= 1) {
      return;
    }

    const nowIso = new Date().toISOString();
    const nextCompletions = { ...currentState.completions };
    let addedCount = 0;

    for (let day = 1; day < currentRuntime.activeDay; day += 1) {
      const key = String(day);
      if (!nextCompletions[key]) {
        nextCompletions[key] = {
          day,
          method: 'bulk_confirm_past',
          timestamp: nowIso
        };
        addedCount += 1;
      }
    }

    if (addedCount === 0) {
      return;
    }

    const nextBase: OmerCycleState = {
      ...currentState,
      completions: nextCompletions
    };

    const derived = applyHalachicDerivations(nextBase, currentRuntime);
    const withEvent = withQueuedEvent(
      derived,
      makeSyncEvent('completion', {
        method: 'bulk_confirm_past',
        throughDay: currentRuntime.activeDay - 1,
        addedCount
      })
    );

    await commitState(withEvent);
  }, [commitState]);

  const setMissedEarlierOverride = useCallback(async () => {
    const currentRuntime = runtimeRef.current;
    const currentState = stateRef.current;

    const next = withQueuedEvent(
      applyHalachicDerivations(
        {
          ...currentState,
          overrideMissedEarlier: true
        },
        currentRuntime
      ),
      makeSyncEvent('missed_override', { value: true })
    );

    await commitState(next);
  }, [commitState]);

  const clearMissedEarlierOverride = useCallback(async () => {
    const currentRuntime = runtimeRef.current;
    const currentState = stateRef.current;

    const next = withQueuedEvent(
      applyHalachicDerivations(
        {
          ...currentState,
          overrideMissedEarlier: false
        },
        currentRuntime
      ),
      makeSyncEvent('missed_override', { value: false })
    );

    await commitState(next);
  }, [commitState]);

  const snooze = useCallback(
    async (minutes: 10 | 20 | 30) => {
      const currentRuntime = runtimeRef.current;
      const currentState = stateRef.current;

      if (!currentRuntime.inSefira || currentRuntime.activeDay === null) {
        return;
      }

      const next: OmerCycleState = {
        ...currentState,
        snoozeUntil: new Date(Date.now() + minutes * 60_000).toISOString()
      };

      await commitState(next);
      await scheduleSnoozeReminder(
        currentRuntime.activeDay,
        minutes,
        currentState.settings,
        currentState.settings.showBracha && !currentState.missedFullDay
      );
    },
    [commitState]
  );

  const updateSettings = useCallback(
    async (patch: Partial<SettingsState>) => {
      const currentRuntime = runtimeRef.current;
      const currentState = stateRef.current;

      const nextSettings = applySettingPatch(currentState.settings, patch);
      const nextWithDerivations = applyHalachicDerivations(
        {
          ...currentState,
          settings: nextSettings
        },
        currentRuntime
      );

      const withEvent = withQueuedEvent(
        nextWithDerivations,
        makeSyncEvent('settings', { patch })
      );

      await commitState(withEvent);
      await refreshRuntime();
    },
    [commitState, refreshRuntime]
  );

  const resetCycleData = useCallback(async () => {
    const currentState = stateRef.current;
    const currentRuntime = runtimeRef.current;

    const base = makeDefaultState(currentState.cycleKey);
    const next = applyHalachicDerivations(
      {
        ...base,
        settings: currentState.settings,
        lastKnownCoords: currentState.lastKnownCoords
      },
      currentRuntime
    );

    await commitState(next);
    await clearPendingOmerNotifications();
  }, [commitState]);

  const value: OmerLockContextValue = {
    state,
    runtime,
    loading,
    refreshRuntime,
    markDayCompleted,
    markAlreadyCounted,
    markPastDaysAsDone,
    setMissedEarlierOverride,
    clearMissedEarlierOverride,
    snooze,
    updateSettings,
    resetCycleData,
    isTodayCompleted,
    shouldShowLockModal,
    brachaAllowed
  };

  return (
    <OmerLockContext.Provider value={value}>{children}</OmerLockContext.Provider>
  );
};

export const useOmerLock = (): OmerLockContextValue => {
  const context = useContext(OmerLockContext);
  if (!context) {
    throw new Error('useOmerLock must be used inside OmerLockProvider');
  }
  return context;
};
