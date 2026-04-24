import { NUSACH_LIBRARY } from '../constants/nusach';
import { NusachKey, OmerNusachText, OmerPreposition } from '../types';

const EN_UNDER_20 = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen'
];

const EN_TENS: Record<number, string> = {
  20: 'twenty',
  30: 'thirty',
  40: 'forty'
};

const HE_UNDER_11: Record<number, string> = {
  1: 'אחד',
  2: 'שנים',
  3: 'שלשה',
  4: 'ארבעה',
  5: 'חמשה',
  6: 'ששה',
  7: 'שבעה',
  8: 'שמונה',
  9: 'תשעה',
  10: 'עשרה'
};

const HE_TEENS: Record<number, string> = {
  11: 'אחד עשר',
  12: 'שנים עשר',
  13: 'שלשה עשר',
  14: 'ארבעה עשר',
  15: 'חמשה עשר',
  16: 'ששה עשר',
  17: 'שבעה עשר',
  18: 'שמונה עשר',
  19: 'תשעה עשר'
};

const HE_TENS: Record<number, string> = {
  20: 'עשרים',
  30: 'שלשים',
  40: 'ארבעים'
};

const plural = (count: number, singular: string, pluralWord: string): string =>
  count === 1 ? singular : pluralWord;

const getEnglishUnder20 = (value: number): string => EN_UNDER_20[value] ?? String(value);

const getEnglishTens = (value: number): string => EN_TENS[value] ?? String(value);

const getHebrewUnder11 = (value: number): string => HE_UNDER_11[value] ?? String(value);

const getHebrewTeen = (value: number): string => HE_TEENS[value] ?? String(value);

const getHebrewTens = (value: number): string => HE_TENS[value] ?? String(value);

const toEnglishNumber = (value: number): string => {
  if (value < 20) {
    return getEnglishUnder20(value);
  }

  const tens = Math.floor(value / 10) * 10;
  const unit = value % 10;

  if (unit === 0) {
    return getEnglishTens(tens);
  }

  return `${getEnglishTens(tens)}-${getEnglishUnder20(unit)}`;
};

const toHebrewNumber = (value: number): string => {
  if (value <= 10) {
    return getHebrewUnder11(value);
  }

  if (value < 20) {
    return getHebrewTeen(value);
  }

  const tens = Math.floor(value / 10) * 10;
  const unit = value % 10;

  if (unit === 0) {
    return getHebrewTens(tens);
  }

  return `${getHebrewUnder11(unit)} ו${getHebrewTens(tens)}`;
};

const hebrewDayCount = (day: number): string => {
  if (day === 1) {
    return 'יום אחד';
  }

  if (day === 2) {
    return 'שני ימים';
  }

  if (day <= 10) {
    return `${toHebrewNumber(day)} ימים`;
  }

  return `${toHebrewNumber(day)} יום`;
};

const hebrewWeekCount = (weeks: number): string => {
  if (weeks === 1) {
    return 'שבוע אחד';
  }

  if (weeks === 2) {
    return 'שני שבועות';
  }

  return `${toHebrewNumber(weeks)} שבועות`;
};

const hebrewRemainderCount = (days: number): string => {
  if (days === 0) {
    return '';
  }

  if (days === 1) {
    return 'ויום אחד';
  }

  if (days === 2) {
    return 'ושני ימים';
  }

  if (days <= 10) {
    return `ו${toHebrewNumber(days)} ימים`;
  }

  return `ו${toHebrewNumber(days)} יום`;
};

export const getEnglishCountText = (day: number): string => {
  const weeks = Math.floor(day / 7);
  const days = day % 7;

  const base = `Today is ${toEnglishNumber(day)} ${plural(day, 'day', 'days')} of the Omer.`;

  if (weeks === 0) {
    return base;
  }

  const weekPart = `${toEnglishNumber(weeks)} ${plural(weeks, 'week', 'weeks')}`;
  const dayPart =
    days > 0
      ? ` and ${toEnglishNumber(days)} ${plural(days, 'day', 'days')}`
      : '';

  return `${base} That is ${weekPart}${dayPart}.`;
};

export const getHebrewCountText = (day: number, omerPreposition: OmerPreposition = 'baomer'): string => {
  const weeks = Math.floor(day / 7);
  const days = day % 7;
  const prepositionText = omerPreposition === 'baomer' ? 'בעומר' : 'לעומר';

  const base = `היום ${hebrewDayCount(day)}`;

  if (weeks === 0) {
    return `${base} ${prepositionText}.`;
  }

  const weekPart = hebrewWeekCount(weeks);
  const dayPart = hebrewRemainderCount(days);

  return `${base} שהם ${weekPart}${dayPart ? ` ${dayPart}` : ''} ${prepositionText}.`;
};

export const getNusachText = (
  day: number,
  nusach: NusachKey,
  includeBracha: boolean,
  omerPreposition: OmerPreposition = 'baomer'
): OmerNusachText => {
  const selected = NUSACH_LIBRARY[nusach];

  return {
    bracha: includeBracha ? selected.bracha : 'ללא ברכה: ממשיכים לספור.',
    countHebrew: getHebrewCountText(day, omerPreposition),
    countEnglish: getEnglishCountText(day),
    harachaman: selected.harachaman
  };
};

export const getNotificationBody = (
  day: number,
  nusach: NusachKey,
  includeBracha: boolean,
  omerPreposition: OmerPreposition = 'baomer'
): string => {
  const text = getNusachText(day, nusach, includeBracha, omerPreposition);
  return [text.bracha, text.countHebrew, text.countEnglish, text.harachaman].join('\n');
};
