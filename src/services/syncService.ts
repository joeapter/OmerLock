import 'react-native-url-polyfill/auto';

import NetInfo from '@react-native-community/netinfo';
import { createClient } from '@supabase/supabase-js';

import { OmerCycleState, SyncEvent } from '../types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const client =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      })
    : null;

export const isSyncEnabled = (): boolean => Boolean(client);

const hasNetwork = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
};

export const syncPendingEvents = async (
  cycleKey: string,
  events: SyncEvent[]
): Promise<SyncEvent[]> => {
  if (!client || events.length === 0) {
    return events;
  }

  if (!(await hasNetwork())) {
    return events;
  }

  const rows = events.map((event) => ({
    id: event.id,
    cycle_key: cycleKey,
    type: event.type,
    payload: event.payload,
    created_at: event.createdAt
  }));

  const { error } = await client.from('omer_events').upsert(rows, { onConflict: 'id' });

  if (error) {
    return events;
  }

  return [];
};

export const syncSnapshot = async (state: OmerCycleState): Promise<void> => {
  if (!client) {
    return;
  }

  if (!(await hasNetwork())) {
    return;
  }

  await client.from('omer_state').upsert({
    cycle_key: state.cycleKey,
    payload: {
      completions: state.completions,
      missedDays: state.missedDays,
      missedFullDay: state.missedFullDay,
      streak: state.streak,
      settings: state.settings,
      overrideMissedEarlier: state.overrideMissedEarlier,
      updatedAt: state.updatedAt
    },
    updated_at: new Date().toISOString()
  });
};
