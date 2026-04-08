import { LatLng } from '../types';
import { addDays, setTimeOnDate, toDateKey } from '../utils/date';

interface HebcalTimesResponse {
  times?: Record<string, string>;
  zmanim?: Record<string, string>;
}

interface HebcalZmanim {
  tzeit: Date | null;
  sunrise: Date | null;
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
  const zmanim = await fetchZmanimFromHebcal(date, coords);
  return zmanim.tzeit;
};

export const fetchZmanimFromHebcal = async (
  date: Date,
  coords: LatLng
): Promise<HebcalZmanim> => {
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
      return {
        tzeit: null,
        sunrise: null
      };
    }

    const payload = (await response.json()) as HebcalTimesResponse;
    const bag = payload.times ?? payload.zmanim ?? {};
    const sunrise = bag.sunrise ? parseHebcalTime(bag.sunrise) : null;

    const explicitTzeit = pickFirstDefined(
      bag.tzeit42min,
      bag.tzeit50min,
      bag.tzeit72min,
      bag.tzeit,
      bag.nightfall
    );

    if (explicitTzeit) {
      return {
        tzeit: parseHebcalTime(explicitTzeit),
        sunrise
      };
    }

    const sunset = bag.sunset ? parseHebcalTime(bag.sunset) : null;
    if (sunset) {
      return {
        tzeit: addMinutes(sunset, 42),
        sunrise
      };
    }

    return {
      tzeit: null,
      sunrise
    };
  } catch {
    return {
      tzeit: null,
      sunrise: null
    };
  } finally {
    clearTimeout(timeout);
  }
};

export const resolveTzeit = async (
  date: Date,
  fallbackHHMM: string,
  coords?: LatLng
): Promise<{ time: Date; source: 'hebcal' | 'fallback' }> => {
  const resolved = await resolveZmanim(date, fallbackHHMM, coords);
  return {
    time: resolved.tzeit,
    source: resolved.tzeitSource
  };
};

export const resolveZmanim = async (
  date: Date,
  fallbackTzeitHHMM: string,
  coords?: LatLng
): Promise<{
  tzeit: Date;
  sunrise: Date;
  tzeitSource: 'hebcal' | 'fallback';
  sunriseSource: 'hebcal' | 'fallback';
}> => {
  let tzeit: Date | null = null;
  let sunrise: Date | null = null;
  let tzeitSource: 'hebcal' | 'fallback' = 'fallback';
  let sunriseSource: 'hebcal' | 'fallback' = 'fallback';

  if (coords) {
    const hebcal = await fetchZmanimFromHebcal(date, coords);
    if (hebcal.tzeit) {
      tzeit = hebcal.tzeit;
      tzeitSource = 'hebcal';
    }
    if (hebcal.sunrise) {
      sunrise = hebcal.sunrise;
      sunriseSource = 'hebcal';
    }
  }

  if (!tzeit) {
    tzeit = setTimeOnDate(date, fallbackTzeitHHMM);
  }

  if (!sunrise) {
    sunrise = setTimeOnDate(date, '06:00');
  }

  return {
    tzeit,
    sunrise,
    tzeitSource,
    sunriseSource
  };
};

export const getNextCivilDate = (date: Date, afterTzeit: boolean): Date =>
  afterTzeit ? addDays(date, 1) : date;
