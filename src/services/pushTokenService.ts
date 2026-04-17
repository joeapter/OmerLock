// pushTokenService.ts
//
// Registers this device's Expo push token in Supabase and writes a 5-night
// schedule so the server-side cron can push at the correct nightfall time for
// each upcoming night — even if the app is never opened on those nights.
//
// Key insight: tzeit is computed on the device from the user's location and
// stored as a UTC timestamp. The server does tzeit_utc <= now() — no timezone
// math needed server-side.

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { createClient } from '@supabase/supabase-js';

import { LatLng } from '../types';
import { addDays } from '../utils/date';
import { resolveZmanim } from './hebcalService';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;

const NIGHTS_AHEAD = 5;

const getClient = () => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
};

let cachedToken: string | null = null;

const getPushToken = async (): Promise<string | null> => {
  if (cachedToken) return cachedToken;
  if (!PROJECT_ID) return null;

  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    cachedToken = result.data;
    return cachedToken;
  } catch {
    return null;
  }
};

// Called whenever the runtime is refreshed (app open, foreground resume).
// Writes a schedule row for tonight + each of the next NIGHTS_AHEAD nights,
// each with its own accurate tzeit_utc computed from the user's location.
export const syncPushToken = async (
  day: number,
  tzeit: Date,
  cycleKey: string,
  counted: boolean,
  fallbackTzeit: string,
  coords?: LatLng
): Promise<void> => {
  const client = getClient();
  if (!client) return;

  const token = await getPushToken();
  if (!token) return;

  // Keep push_tokens in sync for backwards compat (used by old cron logic)
  try {
    await client.from('push_tokens').upsert(
      {
        token,
        tzeit_utc: tzeit.toISOString(),
        counted,
        active_day: day,
        cycle_key: cycleKey,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'token' }
    );
  } catch {
    // non-fatal
  }

  // Build the 5-night schedule: tonight + the next NIGHTS_AHEAD nights.
  // Each gets its own resolveZmanim call so the tzeit is accurate for that
  // specific calendar date — never just copying tonight's clock time forward.
  const rows: Array<{
    token: string;
    day: number;
    tzeit_utc: string;
    counted: boolean;
    cycle_key: string;
    updated_at: string;
  }> = [];

  // Tonight (day n, tzeit already computed)
  rows.push({
    token,
    day,
    tzeit_utc: tzeit.toISOString(),
    counted,
    cycle_key: cycleKey,
    updated_at: new Date().toISOString()
  });

  // Upcoming nights
  for (let n = 1; n <= NIGHTS_AHEAD; n++) {
    const futureDay = day + n;
    if (futureDay > 49) break;

    const futureDate = addDays(tzeit, n);

    let futureTzeit: Date;
    try {
      const zmanim = await resolveZmanim(futureDate, fallbackTzeit, coords);
      futureTzeit = zmanim.tzeit;
    } catch {
      // Fallback: shift tonight's tzeit by n days (imprecise but safe)
      futureTzeit = futureDate;
    }

    rows.push({
      token,
      day: futureDay,
      tzeit_utc: futureTzeit.toISOString(),
      counted: false, // future nights are always uncounted
      cycle_key: cycleKey,
      updated_at: new Date().toISOString()
    });
  }

  try {
    await client
      .from('push_schedule')
      .upsert(rows, { onConflict: 'token,day' });
  } catch {
    // non-fatal
  }
};

// Called immediately when the user counts. Marks tonight's row as counted
// so the next hourly cron skips this device for tonight.
export const markPushTokenCounted = async (day: number): Promise<void> => {
  const client = getClient();
  if (!client) return;

  const token = await getPushToken();
  if (!token) return;

  const now = new Date().toISOString();

  // Mark in both tables
  try {
    await Promise.all([
      client
        .from('push_tokens')
        .update({ counted: true, updated_at: now })
        .eq('token', token),
      client
        .from('push_schedule')
        .update({ counted: true, updated_at: now })
        .eq('token', token)
        .eq('day', day)
    ]);
  } catch {
    // non-fatal
  }
};
