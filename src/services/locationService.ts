import * as Location from 'expo-location';

import { LatLng } from '../types';

// Refresh GPS at most once every 4 hours. Tzeit only needs to be accurate to
// the minute — there's no value in re-fetching on every foreground resume.
const LOCATION_CACHE_TTL_MS = 4 * 60 * 60_000;

let cachedCoords: LatLng | null = null;
let cachedAt = 0;

const hasFreshCache = (): boolean => {
  if (!cachedCoords) return false;
  return Date.now() - cachedAt < LOCATION_CACHE_TTL_MS;
};

// Called once at bootstrap with the coords already persisted in AsyncStorage.
// This prevents the GPS from firing on the first open when we already have
// a good set of coordinates from last time.
export const prewarmLocationCache = (coords: LatLng): void => {
  if (cachedCoords) return; // already warmed this session
  cachedCoords = coords;
  // Mark as slightly stale so it refreshes within the hour, but not immediately.
  cachedAt = Date.now() - LOCATION_CACHE_TTL_MS + 60 * 60_000;
};

export const getCurrentCoords = async (fallback?: LatLng): Promise<LatLng | null> => {
  if (hasFreshCache()) {
    return cachedCoords;
  }

  try {
    const existing = await Location.getForegroundPermissionsAsync();

    let granted = existing.granted;
    if (!granted) {
      if (!existing.canAskAgain) {
        return cachedCoords ?? fallback ?? null;
      }
      const requested = await Location.requestForegroundPermissionsAsync();
      granted = requested.granted;
    }

    if (!granted) {
      return cachedCoords ?? fallback ?? null;
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced
    });

    const next: LatLng = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    };

    cachedCoords = next;
    cachedAt = Date.now();
    return next;
  } catch {
    return cachedCoords ?? fallback ?? null;
  }
};
