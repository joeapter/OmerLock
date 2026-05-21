// pushTokenService.ts
//
// Registers this device's Expo push token in Supabase and writes the full
// remaining-Omer schedule so the server-side cron can push at nightfall for
// every upcoming night — even if the app is never opened again.
//
// Key insight: tzeit is computed on the device from the user's location and
// stored as a UTC timestamp. The server does tzeit_utc <= now() — no timezone
// math needed server-side.

import * as Notifications from 'expo-notifications';
import { createClient } from '@supabase/supabase-js';

import { LatLng } from '../types';
import { addDays } from '../utils/date';
import { resolveZmanim } from './hebcalService';
import {
  EAS_PROJECT_ID,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  warnMissingSupabaseConfig
} from './supabaseConfig';

const HEBCAL_NIGHTS = 5; // nights to fetch via Hebcal API (location-accurate)

const getClient = () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    warnMissingSupabaseConfig('pushTokenService');
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
};

let cachedToken: string | null = null;

const getPushToken = async (): Promise<string | null> => {
  if (cachedToken) return cachedToken;
  if (!EAS_PROJECT_ID) {
    console.warn('[push] Missing Expo projectId, cannot fetch push token.');
    return null;
  }

  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    cachedToken = result.data;
    return cachedToken;
  } catch (error) {
    console.warn('[push] Failed to fetch Expo push token.', error);
    return null;
  }
};

// Called whenever the runtime is refreshed (app open, foreground resume).
// Writes a schedule row for tonight + each of the next NIGHTS_AHEAD nights,
// each with its own accurate tzeit_utc computed from the user's location.
// Pass tzeitTimes (the season cache) to skip redundant Hebcal API calls.
export const syncPushToken = async (
  day: number,
  tzeit: Date,
  cycleKey: string,
  counted: boolean,
  fallbackTzeit: string,
  coords?: LatLng,
  tzeitTimes?: Record<number, string>
): Promise<void> => {
  const client = getClient();
  if (!client) return;

  const token = await getPushToken();
  if (!token) return;

  // Keep push_tokens in sync for backwards compat (used by old cron logic)
  try {
    const { error } = await client.from('push_tokens').upsert(
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

    if (error) {
      console.warn('[push] Failed to upsert push_tokens row.', error.message);
    }
  } catch (error) {
    console.warn('[push] Failed to write push_tokens row.', error);
  }

  // Build the full remaining-Omer schedule: tonight + every remaining night.
  // First HEBCAL_NIGHTS use resolveZmanim for location-accurate tzeit.
  // Beyond that, addDays copies tonight's clock time (~2 min/day drift) —
  // close enough for the hourly cron, and refreshed when the app next opens.
  const rows: Array<{
    token: string;
    day: number;
    tzeit_utc: string;
    counted: boolean;
    cycle_key: string;
    updated_at: string;
  }> = [];

  const now = new Date().toISOString();

  // Tonight (day n, tzeit already computed)
  rows.push({
    token,
    day,
    tzeit_utc: tzeit.toISOString(),
    counted,
    cycle_key: cycleKey,
    updated_at: now
  });

  // All remaining nights up to day 49
  const remainingNights = 49 - day;
  for (let n = 1; n <= remainingNights; n++) {
    const futureDay = day + n;
    const futureDate = addDays(tzeit, n);

    let futureTzeit: Date;
    const cachedTime = tzeitTimes?.[futureDay];
    if (cachedTime) {
      futureTzeit = new Date(cachedTime);
    } else if (n <= HEBCAL_NIGHTS) {
      try {
        const zmanim = await resolveZmanim(futureDate, fallbackTzeit, coords);
        futureTzeit = zmanim.tzeit;
      } catch {
        futureTzeit = futureDate;
      }
    } else {
      futureTzeit = futureDate;
    }

    rows.push({
      token,
      day: futureDay,
      tzeit_utc: futureTzeit.toISOString(),
      counted: false,
      cycle_key: cycleKey,
      updated_at: now
    });
  }

  try {
    const { error } = await client
      .from('push_schedule')
      .upsert(rows, { onConflict: 'token,day' });

    if (error) {
      console.warn('[push] Failed to upsert push_schedule rows.', error.message);
    }
  } catch (error) {
    console.warn('[push] Failed to write push_schedule rows.', error);
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
    const [tokenResult, scheduleResult] = await Promise.all([
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

    if (tokenResult.error) {
      console.warn('[push] Failed to mark push_tokens row counted.', tokenResult.error.message);
    }

    if (scheduleResult.error) {
      console.warn(
        '[push] Failed to mark push_schedule row counted.',
        scheduleResult.error.message
      );
    }
  } catch (error) {
    console.warn('[push] Failed to mark push rows counted.', error);
  }
};
