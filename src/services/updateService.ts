import { Alert, Linking } from 'react-native';

import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, warnMissingSupabaseConfig } from './supabaseConfig';

// App Store product page (ascAppId from eas.json)
const APP_STORE_URL = 'https://apps.apple.com/app/id6761617604';

const getClient = () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    warnMissingSupabaseConfig('updateService');
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
    const { data, error } = await client
      .from('app_config')
      .select('value')
      .eq('key', 'min_version')
      .single();

    if (error) {
      console.warn('[update] Failed to fetch min_version.', error.message);
      return;
    }

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
  } catch (error) {
    console.warn('[update] Version check failed.', error);
  }
};
