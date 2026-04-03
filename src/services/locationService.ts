import * as Location from 'expo-location';

import { LatLng } from '../types';

const LOCATION_CACHE_TTL_MS = 60_000;

let cachedCoords: LatLng | null = null;
let cachedAt = 0;

const hasFreshCache = (): boolean => {
  if (!cachedCoords) {
    return false;
  }

  return Date.now() - cachedAt < LOCATION_CACHE_TTL_MS;
};

export const getCurrentCoords = async (fallback?: LatLng): Promise<LatLng | null> => {
  if (hasFreshCache()) {
    return cachedCoords;
  }

  try {
    const existing = await Location.getForegroundPermissionsAsync();

    let granted = existing.granted;
    if (!granted) {
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
