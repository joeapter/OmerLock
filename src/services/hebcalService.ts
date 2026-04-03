import { LatLng } from '../types';
import { addDays, setTimeOnDate, toDateKey } from '../utils/date';

interface HebcalTimesResponse {
  times?: Record<string, string>;
  zmanim?: Record<string, string>;
}

const pickFirstDefined = (...values: Array<string | undefined>): string | undefined =>
  values.find((value) => Boolean(value));

const parseHebcalTime = (value: string): Date | null => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const addMinutes = (date: Date, minutes: number): Date =>
  new Date(date.getTime() + minutes * 60_000);

export const fetchTzeitFromHebcal = async (
  date: Date,
  coords: LatLng
): Promise<Date | null> => {
  const params = new URLSearchParams({
    cfg: 'json',
    latitude: String(coords.latitude),
    longitude: String(coords.longitude),
    date: toDateKey(date)
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`https://www.hebcal.com/zmanim?${params.toString()}`, {
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as HebcalTimesResponse;
    const bag = payload.times ?? payload.zmanim ?? {};

    const explicitTzeit = pickFirstDefined(
      bag.tzeit42min,
      bag.tzeit50min,
      bag.tzeit72min,
      bag.tzeit,
      bag.nightfall
    );

    if (explicitTzeit) {
      return parseHebcalTime(explicitTzeit);
    }

    const sunset = bag.sunset ? parseHebcalTime(bag.sunset) : null;
    if (sunset) {
      return addMinutes(sunset, 42);
    }

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

export const resolveTzeit = async (
  date: Date,
  fallbackHHMM: string,
  coords?: LatLng
): Promise<{ time: Date; source: 'hebcal' | 'fallback' }> => {
  if (coords) {
    const hebcal = await fetchTzeitFromHebcal(date, coords);
    if (hebcal) {
      return { time: hebcal, source: 'hebcal' };
    }
  }

  return {
    time: setTimeOnDate(date, fallbackHHMM),
    source: 'fallback'
  };
};

export const getNextCivilDate = (date: Date, afterTzeit: boolean): Date =>
  afterTzeit ? addDays(date, 1) : date;
