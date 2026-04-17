// Supabase Edge Function — send-omer-reminders
// Runs every hour at :00 via pg_cron (see schema.sql).
//
// Logic:
//   Query push_schedule where tzeit_utc <= now() AND counted = false
//   AND tzeit_utc > now() - 23h  (ignore stale rows from >1 night ago)
//   Send a push to each matching device/night combo.
//
// Each row in push_schedule represents ONE device on ONE omer night, with
// the exact tzeit_utc for that night computed on the device from the user's
// own location. The server does pure UTC math — no timezone conversion.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ScheduleRow {
  token: string;
  day: number;
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
const EXPO_BATCH_SIZE = 100;

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = new Date();
  const windowStart = new Date(now.getTime() - 23 * 60 * 60 * 1000);

  // Find every device/night where:
  //   • that night's tzeit has passed (tzeit_utc <= now)
  //   • the user hasn't counted yet for that night
  //   • the row is from within the last 23h (not a stale old night)
  const { data: rows, error } = await supabase
    .from('push_schedule')
    .select('token, day')
    .lte('tzeit_utc', now.toISOString())
    .gte('tzeit_utc', windowStart.toISOString())
    .eq('counted', false);

  if (error) {
    console.error('DB query failed:', error.message);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return new Response('No reminders needed this hour.', { status: 200 });
  }

  const messages: ExpoMessage[] = (rows as ScheduleRow[]).map((row) => ({
    to: row.token,
    title: '🕯️ Count the Omer Tonight',
    body: `It's night ${row.day} of the Omer. Open OmerLock to count — takes 10 seconds.`,
    sound: 'default',
    priority: 'high',
    data: { kind: 'omer_push', day: row.day }
  }));

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
