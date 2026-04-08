// pushTokenService.ts
//
// Registers this device's Expo push token in Supabase so the server-side cron
// can send push notifications at nightfall even when the app is closed.
//
// The key insight: we write tzeit_utc as a UTC timestamp computed on the device
// from the user's own location. The server never touches timezones — it just
// compares tzeit_utc <= now() in UTC.

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;

const getClient = () => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
};

// Cache the token within the session so we're not calling getExpoPushTokenAsync
// on every foreground resume.
let cachedToken: string | null = null;

const getPushToken = async (): Promise<string | null> => {
  if (cachedToken) return cachedToken;
  if (!PROJECT_ID) return null;

  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    cachedToken = result.data;
    return cachedToken;
  } catch {
    // Simulator, or permissions not granted — non-fatal
    return null;
  }
};

// Call this whenever the runtime is refreshed (app open, foreground resume).
// Upserts the token row with the current night's tzeit_utc and counted status.
export const syncPushToken = async (
  day: number,
  tzeit: Date,
  cycleKey: string,
  counted: boolean
): Promise<void> => {
  const client = getClient();
  if (!client) return;

  const token = await getPushToken();
  if (!token) return;

  try {
    await client.from('push_tokens').upsert(
      {
        token,
        // Store as UTC — the server does tzeit_utc <= now() which is pure UTC math.
        // No server-side timezone conversion needed.
        tzeit_utc: tzeit.toISOString(),
        counted,
        active_day: day,
        cycle_key: cycleKey,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'token' }
    );
  } catch {
    // Non-fatal — local notifications are the fallback
  }
};

// Call this immediately when the user completes their count so the next
// hourly cron run skips this device.
export const markPushTokenCounted = async (): Promise<void> => {
  const client = getClient();
  if (!client) return;

  const token = await getPushToken();
  if (!token) return;

  try {
    await client
      .from('push_tokens')
      .update({ counted: true, updated_at: new Date().toISOString() })
      .eq('token', token);
  } catch {
    // Non-fatal
  }
};
