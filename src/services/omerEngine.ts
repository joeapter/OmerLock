import { OmerRuntime, SettingsState, TzeitSource } from '../types';
import { addDays, toDateKey } from '../utils/date';
import { getCurrentCoords } from './locationService';
import { getNextCivilDate, resolveZmanim } from './hebcalService';

interface HebrewDateParts {
  year: number;
  monthName: string;
  day: number;
}

const HEBREW_MONTH_ALIASES: Record<string, string> = {
  nisan: 'nisan',
  nissan: 'nisan',
  iyyar: 'iyar',
  iyar: 'iyar',
  sivan: 'sivan'
};

const getHebrewDate = (date: Date): HebrewDateParts => {
  try {
    const formatter = new Intl.DateTimeFormat('en-u-ca-hebrew', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const parts = formatter.formatToParts(date);

    const year = Number(parts.find((part) => part.type === 'year')?.value ?? '0');
    const monthNameRaw = parts.find((part) => part.type === 'month')?.value ?? '';
    const day = Number(parts.find((part) => part.type === 'day')?.value ?? '0');

    return {
      year,
      monthName: monthNameRaw.trim().toLowerCase(),
      day
    };
  } catch {
    return {
      year: date.getFullYear() + 3760,
      monthName: '',
      day: 0
    };
  }
};

const normalizeMonth = (value: string): string => {
  const stripped = value.replace(/[^a-z]/g, '');
  return HEBREW_MONTH_ALIASES[stripped] ?? stripped;
};

export const getOmerDayFromDate = (date: Date): number | null => {
  const hebrew = getHebrewDate(date);
  const month = normalizeMonth(hebrew.monthName);

  if (month === 'nisan' && hebrew.day >= 16 && hebrew.day <= 30) {
    return hebrew.day - 15;
  }

  if (month === 'iyar' && hebrew.day >= 1 && hebrew.day <= 29) {
    return 15 + hebrew.day;
  }

  if (month === 'sivan' && hebrew.day >= 1 && hebrew.day <= 5) {
    return 44 + hebrew.day;
  }

  return null;
};

export const getCycleKey = (date: Date): string => {
  const hebrew = getHebrewDate(date);
  return String(hebrew.year);
};

export const computeRuntime = async (
  settings: SettingsState,
  knownCoords?: { latitude: number; longitude: number }
): Promise<{
  runtime: OmerRuntime;
  cycleKey: string;
  resolvedCoords?: { latitude: number; longitude: number };
}> => {
  const now = new Date();
  const coords = (await getCurrentCoords(knownCoords)) ?? undefined;

  const todayZmanim = await resolveZmanim(now, settings.fallbackTzeit, coords);
  const nowAfterTzeit = now >= todayZmanim.tzeit;
  const nowBeforeMorningSwitch = now < todayZmanim.sunrise;
  const countWindow = nowAfterTzeit || nowBeforeMorningSwitch ? 'tonight' : 'last_night';

  const activeDate = getNextCivilDate(now, nowAfterTzeit);
  const activeDay = getOmerDayFromDate(activeDate);
  const inSefira = activeDay !== null;
  const cycleKey = getCycleKey(activeDate);

  const nextTzeitDate = nowAfterTzeit ? addDays(now, 1) : now;
  const nextZmanim =
    nowAfterTzeit && inSefira
      ? await resolveZmanim(nextTzeitDate, settings.fallbackTzeit, coords)
      : todayZmanim;

  const runtime: OmerRuntime = {
    inSefira,
    activeDay,
    cycleKey,
    activeDateKey: toDateKey(activeDate),
    tzeitToday: todayZmanim.tzeit,
    nextTzeit: nextZmanim.tzeit,
    nowAfterTzeit,
    countWindow,
    tzeitSource: (todayZmanim.tzeitSource as TzeitSource) || 'fallback'
  };

  return {
    runtime,
    cycleKey,
    resolvedCoords: coords
  };
};
