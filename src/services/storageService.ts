import AsyncStorage from '@react-native-async-storage/async-storage';

import { makeDefaultState } from '../constants/defaults';
import { OmerCycleState, SettingsState } from '../types';

const STORAGE_KEY = '@omerlock/state/v1';

const sanitizeReminderMinutes = (value: unknown, fallback: number): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.min(60, Math.max(3, Math.round(num)));
};

const sanitizeSnoozeMinutes = (value: unknown, fallback: 10 | 20 | 30): 10 | 20 | 30 => {
  if (value === 10 || value === 20 || value === 30) {
    return value;
  }
  return fallback;
};

const sanitizeSettings = (
  partial: Partial<SettingsState> | undefined,
  fallback: SettingsState
): SettingsState => ({
  showBracha: partial?.showBracha ?? fallback.showBracha,
  nusach: partial?.nusach ?? fallback.nusach,
  omerPreposition:
    partial?.omerPreposition === 'laomer' || partial?.omerPreposition === 'baomer'
      ? partial.omerPreposition
      : fallback.omerPreposition,
  reminderBaseMinutes: sanitizeReminderMinutes(
    partial?.reminderBaseMinutes,
    fallback.reminderBaseMinutes
  ),
  defaultSnoozeMinutes: sanitizeSnoozeMinutes(
    partial?.defaultSnoozeMinutes,
    fallback.defaultSnoozeMinutes
  ),
  fallbackTzeit: partial?.fallbackTzeit ?? fallback.fallbackTzeit,
  hardcoreMode: partial?.hardcoreMode ?? fallback.hardcoreMode,
  escalationEnabled: partial?.escalationEnabled ?? fallback.escalationEnabled,
  morningCatchupEnabled: partial?.morningCatchupEnabled ?? fallback.morningCatchupEnabled
});

const migrateState = (
  parsed: Partial<OmerCycleState>,
  cycleKey: string
): OmerCycleState => {
  const base = makeDefaultState(cycleKey);

  return {
    ...base,
    ...parsed,
    cycleKey,
    settings: sanitizeSettings(parsed.settings, base.settings),
    completions: parsed.completions ?? {},
    missedDays: parsed.missedDays ?? [],
    pendingSyncEvents: parsed.pendingSyncEvents ?? [],
    updatedAt: parsed.updatedAt ?? new Date().toISOString()
  };
};

export const loadState = async (cycleKey: string): Promise<OmerCycleState> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return makeDefaultState(cycleKey);
    }

    const parsed = JSON.parse(raw) as Partial<OmerCycleState>;

    if (parsed.cycleKey !== cycleKey) {
      const base = makeDefaultState(cycleKey);
      return {
        ...base,
        settings: sanitizeSettings(parsed.settings, base.settings),
        pendingSyncEvents: parsed.pendingSyncEvents ?? []
      };
    }

    return migrateState(parsed, cycleKey);
  } catch {
    return makeDefaultState(cycleKey);
  }
};

export const saveState = async (state: OmerCycleState): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const clearState = async (): Promise<void> => {
  await AsyncStorage.removeItem(STORAGE_KEY);
};
