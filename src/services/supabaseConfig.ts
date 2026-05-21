import Constants from 'expo-constants';

interface AppExtra {
  eas?: {
    projectId?: string;
  };
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as AppExtra;

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

export const SUPABASE_URL =
  readString(process.env.EXPO_PUBLIC_SUPABASE_URL) ?? readString(extra.supabaseUrl);

export const SUPABASE_ANON_KEY =
  readString(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) ?? readString(extra.supabaseAnonKey);

export const EAS_PROJECT_ID = readString(extra.eas?.projectId);

let warnedMissingSupabaseConfig = false;

export const warnMissingSupabaseConfig = (caller: string): void => {
  if ((SUPABASE_URL && SUPABASE_ANON_KEY) || warnedMissingSupabaseConfig) {
    return;
  }

  warnedMissingSupabaseConfig = true;
  console.warn(`[supabase] Missing Supabase config in ${caller}.`);
};
