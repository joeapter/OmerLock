import { Alert, Linking } from 'react-native';

import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
// App Store product page (ascAppId from eas.json)
const APP_STORE_URL = 'https://apps.apple.com/app/id6761617604';

const getClient = () => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
};

// Returns negative if a < b, 0 if equal, positive if a > b
const compareVersions = (a: string, b: string): number => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

// Call this after a count is recorded. Fetches min_version from Supabase and
// suggests an update if the installed version is behind — without blocking
// the user or interfering with their count.
export const suggestUpdateIfNeeded = async (message?: string): Promise<void> => {
  const client = getClient();
  if (!client) return;

  const currentVersion = Constants.expoConfig?.version;
  if (!currentVersion) return;

  try {
    const { data } = await client
      .from('app_config')
      .select('value')
      .eq('key', 'min_version')
      .single();

    const minVersion = data?.value as string | undefined;
    if (!minVersion) return;

    if (compareVersions(currentVersion, minVersion) < 0) {
      Alert.alert(
        'Update Available',
        message ?? 'A newer version of OmerLock is available with bug fixes and improvements.',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Update Now',
            onPress: () => Linking.openURL(APP_STORE_URL)
          }
        ]
      );
    }
  } catch {
    // Non-fatal — never interrupt the user over a version check
  }
};
