export type ChallengeType = 'swipe_hold' | 'enter_number' | 'multiple_choice';

export const pickChallenge = (): ChallengeType => {
  const variants: ChallengeType[] = ['swipe_hold', 'enter_number', 'multiple_choice'];
  return variants[Math.floor(Math.random() * variants.length)];
};

export const buildMultipleChoice = (targetDay: number): number[] => {
  const set = new Set<number>([targetDay]);

  while (set.size < 3) {
    const offset = Math.floor(Math.random() * 7) - 3;
    const candidate = Math.min(49, Math.max(1, targetDay + offset));
    set.add(candidate);
  }

  return [...set].sort(() => Math.random() - 0.5);
};
