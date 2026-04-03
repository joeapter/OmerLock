export type NusachKey = 'ashkenaz' | 'sefard' | 'edotMizrach';

export type CompletionMethod =
  | 'swipe_hold'
  | 'enter_number'
  | 'multiple_choice'
  | 'already_counted_override';

export type TzeitSource = 'hebcal' | 'fallback';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface SettingsState {
  showBracha: boolean;
  nusach: NusachKey;
  reminderBaseMinutes: number;
  defaultSnoozeMinutes: 10 | 20 | 30;
  fallbackTzeit: string;
  hardcoreMode: boolean;
  escalationEnabled: boolean;
}

export interface CompletionRecord {
  day: number;
  timestamp: string;
  method: CompletionMethod;
}

export interface SyncEvent {
  id: string;
  type: 'completion' | 'missed_override' | 'settings';
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface OmerCycleState {
  cycleKey: string;
  completions: Record<string, CompletionRecord>;
  missedDays: number[];
  missedFullDay: boolean;
  streak: number;
  snoozeUntil?: string;
  overrideMissedEarlier: boolean;
  settings: SettingsState;
  pendingSyncEvents: SyncEvent[];
  lastScheduledDay?: number;
  lastEscalationLevel?: number;
  lastKnownCoords?: LatLng;
  updatedAt: string;
}

export interface OmerRuntime {
  inSefira: boolean;
  activeDay: number | null;
  cycleKey: string;
  activeDateKey: string;
  tzeitToday: Date | null;
  nextTzeit: Date | null;
  nowAfterTzeit: boolean;
  tzeitSource: TzeitSource;
}

export interface OmerNusachText {
  bracha: string;
  countHebrew: string;
  countEnglish: string;
  harachaman: string;
}

export interface OmerLockContextValue {
  state: OmerCycleState;
  runtime: OmerRuntime;
  loading: boolean;
  refreshRuntime: () => Promise<void>;
  markDayCompleted: (method: CompletionMethod) => Promise<void>;
  markAlreadyCounted: () => Promise<void>;
  setMissedEarlierOverride: () => Promise<void>;
  clearMissedEarlierOverride: () => Promise<void>;
  snooze: (minutes: 10 | 20 | 30) => Promise<void>;
  updateSettings: (next: Partial<SettingsState>) => Promise<void>;
  resetCycleData: () => Promise<void>;
  isTodayCompleted: boolean;
  shouldShowLockModal: boolean;
  brachaAllowed: boolean;
}
