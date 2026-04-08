// Supabase Edge Function — send-omer-reminders
// Runs every hour at :00 via pg_cron (see schema.sql).
//
// Logic:
//   1. Query push_tokens where tzeit_utc <= now() AND counted = false
//      AND tzeit_utc > now() - 23h  (ignore yesterday's uncounted rows)
//   2. Send a push notification to each eligible device via Expo's push API.
//
// Time handling:
//   tzeit_utc is written by the device, computed from the user's own location.
//   The server never needs to know about timezones — it just checks UTC timestamps.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface PushToken {
  token: string;
  active_day: number;
}

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: string;
  priority: string;
  data: Record<string, unknown>;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH_SIZE = 100; // Expo hard limit per request

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    // Service role key — auto-injected by Supabase, bypasses RLS
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = new Date();
  const windowStart = new Date(now.getTime() - 23 * 60 * 60 * 1000);

  // Fetch all devices that:
  //   • are past their nightfall (tzeit_utc <= now)
  //   • haven't counted yet tonight
  //   • are within the current night's window (not yesterday's stale row)
  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('token, active_day')
    .lte('tzeit_utc', now.toISOString())
    .gte('tzeit_utc', windowStart.toISOString())
    .eq('counted', false);

  if (error) {
    console.error('DB query failed:', error.message);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }

  if (!tokens || tokens.length === 0) {
    return new Response('No reminders needed this hour.', { status: 200 });
  }

  const messages: ExpoMessage[] = (tokens as PushToken[]).map((row) => ({
    to: row.token,
    title: '🕯️ Count the Omer Tonight',
    body: `It's night ${row.active_day} of the Omer. Open OmerLock to count — takes 10 seconds.`,
    sound: 'default',
    priority: 'high',
    data: { kind: 'omer_push', day: row.active_day }
  }));

  // Send in batches of 100 (Expo limit)
  let sent = 0;
  for (let i = 0; i < messages.length; i += EXPO_BATCH_SIZE) {
    const batch = messages.slice(i, i + EXPO_BATCH_SIZE);

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate'
      },
      body: JSON.stringify(batch)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Expo push batch failed (${i}–${i + batch.length}):`, text);
    } else {
      sent += batch.length;
    }
  }

  return new Response(
    `Sent ${sent} of ${messages.length} reminders.`,
    { status: 200 }
  );
});
