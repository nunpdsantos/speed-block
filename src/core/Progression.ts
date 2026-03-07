import { Difficulty } from './Config';

export interface ProgressTier {
  minScore: number;
  label: string;
  color: number;
}

export const PROGRESS_TIERS: Record<Difficulty, ProgressTier[]> = {
  chill: [
    { minScore: 0, label: 'ROOKIE', color: 0x3b82f6 },
    { minScore: 3500, label: 'SHARP', color: 0x10b981 },
    { minScore: 7000, label: 'PRO', color: 0xfbbf24 },
    { minScore: 15000, label: 'ELITE', color: 0xf59e0b },
    { minScore: 28000, label: 'MASTER', color: 0xef4444 },
    { minScore: 55000, label: 'LEGEND', color: 0xd946ef },
  ],
  fast: [
    { minScore: 0, label: 'ROOKIE', color: 0x3b82f6 },
    { minScore: 2500, label: 'SHARP', color: 0x10b981 },
    { minScore: 5000, label: 'PRO', color: 0xfbbf24 },
    { minScore: 10000, label: 'ELITE', color: 0xf59e0b },
    { minScore: 20000, label: 'MASTER', color: 0xef4444 },
    { minScore: 40000, label: 'LEGEND', color: 0xd946ef },
  ],
  blitz: [
    { minScore: 0, label: 'ROOKIE', color: 0x3b82f6 },
    { minScore: 1500, label: 'SHARP', color: 0x10b981 },
    { minScore: 3200, label: 'PRO', color: 0xfbbf24 },
    { minScore: 7000, label: 'ELITE', color: 0xf59e0b },
    { minScore: 12000, label: 'MASTER', color: 0xef4444 },
    { minScore: 22000, label: 'LEGEND', color: 0xd946ef },
  ],
};

export interface ProgressStatus {
  tiers: ProgressTier[];
  tierIndex: number;
  current: ProgressTier;
  next: ProgressTier | null;
  progressToNext: number;
}

export function getProgressStatus(difficulty: Difficulty, score: number): ProgressStatus {
  const tiers = PROGRESS_TIERS[difficulty];
  let tierIndex = 0;

  for (let i = 0; i < tiers.length; i++) {
    if (score >= tiers[i].minScore) {
      tierIndex = i;
    } else {
      break;
    }
  }

  const current = tiers[tierIndex];
  const next = tierIndex < tiers.length - 1 ? tiers[tierIndex + 1] : null;
  const progressToNext = next
    ? Math.max(0, Math.min((score - current.minScore) / Math.max(next.minScore - current.minScore, 1), 1))
    : 1;

  return {
    tiers,
    tierIndex,
    current,
    next,
    progressToNext,
  };
}

export function getProgressTiers(difficulty: Difficulty): ProgressTier[] {
  return PROGRESS_TIERS[difficulty];
}
