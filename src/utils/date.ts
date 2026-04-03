export const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const toDateKey = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const parseHHMM = (value: string): { hour: number; minute: number } => {
  const [hourRaw, minuteRaw] = value.split(':');
  const hour = Math.min(23, Math.max(0, Number(hourRaw)));
  const minute = Math.min(59, Math.max(0, Number(minuteRaw)));
  return {
    hour: Number.isFinite(hour) ? hour : 20,
    minute: Number.isFinite(minute) ? minute : 30
  };
};

export const setTimeOnDate = (date: Date, hhmm: string): Date => {
  const { hour, minute } = parseHHMM(hhmm);
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
};

export const formatClock = (date: Date | null): string => {
  if (!date) {
    return '--:--';
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const minutesBetween = (from: Date, to: Date): number =>
  Math.floor((to.getTime() - from.getTime()) / 60000);

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
