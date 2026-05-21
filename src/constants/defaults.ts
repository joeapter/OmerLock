import Constants from 'expo-constants';

import { OmerCycleState, SettingsState } from '../types';

const fallbackTzeit =
  (Constants.expoConfig?.extra?.fallbackTzeit as string | undefined) ?? '20:30';

export const DEFAULT_SETTINGS: SettingsState = {
  showBracha: true,
  nusach: 'ashkenaz',
  omerPreposition: 'baomer',
  reminderBaseMinutes: 10,
  defaultSnoozeMinutes: 10,
  fallbackTzeit,
  hardcoreMode: false,
  escalationEnabled: true,
  morningCatchupEnabled: true
};

export const makeDefaultState = (cycleKey: string): OmerCycleState => ({
  cycleKey,
  completions: {},
  missedDays: [],
  missedFullDay: false,
  streak: 0,
  overrideMissedEarlier: false,
  settings: DEFAULT_SETTINGS,
  pendingSyncEvents: [],
  updatedAt: new Date().toISOString()
});
