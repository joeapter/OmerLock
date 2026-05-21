import AsyncStorage from '@react-native-async-storage/async-storage';

import { LatLng } from '../types';
import { addDays } from '../utils/date';
import { resolveZmanim } from './hebcalService';

const CACHE_KEY = '@omerlock/tzeit_cache/v1';

// Round to 2 decimal places (~1 km). Cache stays valid while the user is
// in the same city; resets if they travel far enough to matter.
const COORD_PRECISION = 2;

interface TzeitCache {
  cycleKey: string;
  coordsKey: string;
  times: Record<number, string>; // omer day → ISO timestamp
}

const toCoordKey = (coords: LatLng): string =>
  `${coords.latitude.toFixed(COORD_PRECISION)},${coords.longitude.toFixed(COORD_PRECISION)}`;

const isValid = (cache: TzeitCache, cycleKey: string, coords?: LatLng): boolean => {
  if (cache.cycleKey !== cycleKey) return false;
  if (coords && cache.coordsKey !== toCoordKey(coords)) return false;
  return true;
};

export const loadTzeitCache = async (
  cycleKey: string,
  coords?: LatLng
): Promise<Record<number, string> | null> => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as TzeitCache;
    return isValid(cache, cycleKey, coords) ? cache.times : null;
  } catch {
    return null;
  }
};

export const saveTzeitCache = async (
  cycleKey: string,
  coords: LatLng | undefined,
  times: Record<number, string>
): Promise<void> => {
  try {
    const cache: TzeitCache = {
      cycleKey,
      coordsKey: coords ? toCoordKey(coords) : '',
      times
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Non-critical
  }
};

export const clearTzeitCache = async (): Promise<void> => {
  await AsyncStorage.removeItem(CACHE_KEY);
};

// Fetches all 49 tzeit times for the season.
// One Hebcal API call per night, batched at concurrency 4 to avoid hammering
// the API. Falls back to addDays for any night that fails.
// This is a one-time-per-season operation triggered on first season open.
export const fetchAllSeasonTzeitTimes = async (
  startDay: number,
  firstTzeit: Date,
  fallbackTzeit: string,
  coords?: LatLng
): Promise<Record<number, string>> => {
  const times: Record<number, string> = {};
  times[startDay] = firstTzeit.toISOString();

  const remaining = 49 - startDay;
  const CONCURRENCY = 4;

  for (let i = 1; i <= remaining; i += CONCURRENCY) {
    const batch = Array.from(
      { length: Math.min(CONCURRENCY, remaining - i + 1) },
      (_, j) => i + j
    );

    await Promise.all(
      batch.map(async (n) => {
        const futureDay = startDay + n;
        const futureDate = addDays(firstTzeit, n);
        try {
          const zmanim = await resolveZmanim(futureDate, fallbackTzeit, coords);
          times[futureDay] = zmanim.tzeit.toISOString();
        } catch {
          times[futureDay] = futureDate.toISOString();
        }
      })
    );
  }

  return times;
};
