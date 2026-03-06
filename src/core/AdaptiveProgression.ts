import { Difficulty } from './Config';
import { getProgressStatus, getProgressTiers } from './Progression';
import { getTelemetryTuningSignal, recordRunTelemetry } from './RunTelemetry';
import { RunEndCause, RunSummary } from './types';

const STORAGE_KEY = 'speedblock_adaptive_profile_v1';
const MAX_RECENT_SCORES = 8;

export interface AdaptiveTuning {
  openingGraceMultiplier: number;
  basePressureMultiplier: number;
  recoveryMultiplier: number;
  unlockDelayMultiplier: number;
  rescueWeightMultiplier: number;
  threatWeightMultiplier: number;
}

interface DifficultyAdaptiveProfile {
  totalRuns: number;
  bestScore: number;
  recentScores: number[];
  recentEndCauses: RunEndCause[];
  consecutiveStruggleRuns: number;
  consecutiveStrongRuns: number;
  consecutiveTimeoutRuns: number;
  consecutiveBoardLockRuns: number;
}

type AdaptiveProfile = Record<Difficulty, DifficultyAdaptiveProfile>;

export const DEFAULT_ADAPTIVE_TUNING: AdaptiveTuning = {
  openingGraceMultiplier: 1,
  basePressureMultiplier: 1,
  recoveryMultiplier: 1,
  unlockDelayMultiplier: 1,
  rescueWeightMultiplier: 1,
  threatWeightMultiplier: 1,
};

function createDifficultyProfile(): DifficultyAdaptiveProfile {
  return {
    totalRuns: 0,
    bestScore: 0,
    recentScores: [],
    recentEndCauses: [],
    consecutiveStruggleRuns: 0,
    consecutiveStrongRuns: 0,
    consecutiveTimeoutRuns: 0,
    consecutiveBoardLockRuns: 0,
  };
}

function createProfile(): AdaptiveProfile {
  return {
    chill: createDifficultyProfile(),
    fast: createDifficultyProfile(),
    blitz: createDifficultyProfile(),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function readProfile(): AdaptiveProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createProfile();
    const parsed = JSON.parse(raw) as Partial<AdaptiveProfile>;
    return {
      chill: { ...createDifficultyProfile(), ...parsed.chill },
      fast: { ...createDifficultyProfile(), ...parsed.fast },
      blitz: { ...createDifficultyProfile(), ...parsed.blitz },
    };
  } catch {
    return createProfile();
  }
}

function writeProfile(profile: AdaptiveProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    /* */
  }
}

function getStruggleThreshold(difficulty: Difficulty, bestScore: number): number {
  const tiers = getProgressTiers(difficulty);
  return Math.max(
    Math.round((tiers[1]?.minScore ?? 0) * 0.7),
    Math.round(bestScore * 0.35),
    200,
  );
}

function getStrongThreshold(difficulty: Difficulty, bestScore: number): number {
  const tiers = getProgressTiers(difficulty);
  return Math.max(
    tiers[2]?.minScore ?? 0,
    Math.round(bestScore * 0.78),
  );
}

function deriveTuning(difficulty: Difficulty, profile: DifficultyAdaptiveProfile): AdaptiveTuning {
  if (profile.totalRuns === 0) {
    return {
      openingGraceMultiplier: 1.25,
      basePressureMultiplier: 0.9,
      recoveryMultiplier: 1.25,
      unlockDelayMultiplier: 1.35,
      rescueWeightMultiplier: 1.35,
      threatWeightMultiplier: 0.78,
    };
  }

  const tiers = getProgressTiers(difficulty);
  const onboarding = clamp((6 - profile.totalRuns) / 6, 0, 1);
  const struggle = clamp(profile.consecutiveStruggleRuns / 4, 0, 1);
  const strong = clamp(profile.consecutiveStrongRuns / 4, 0, 1);
  const timeoutStruggle = clamp(profile.consecutiveTimeoutRuns / 3, 0, 1);
  const boardStruggle = clamp(profile.consecutiveBoardLockRuns / 3, 0, 1);
  const recentMedian = median(profile.recentScores);
  const bestTier = getProgressStatus(difficulty, profile.bestScore).tierIndex;
  const recentTier = getProgressStatus(difficulty, recentMedian).tierIndex;
  const telemetry = getTelemetryTuningSignal(difficulty);
  const telemetryConfidence = clamp(telemetry.sampleSize / 8, 0, 1);
  const stagnating =
    profile.totalRuns >= 4 &&
    recentMedian < Math.max(profile.bestScore * 0.55, tiers[Math.max(1, bestTier - 1)]?.minScore ?? 0)
      ? 1
      : 0;
  const telemetryMastery = clamp(
    (telemetry.recentMedianBand / Math.max(tiers.length - 1, 1)) * 0.5 +
    telemetry.averageClearRate * 0.35 +
    (1 - telemetry.lowBandStallRate) * 0.15 -
    telemetry.averageDrySpellRatio * 0.18,
    0,
    1,
  );
  const telemetryTimerAssist = clamp(
    telemetry.timeoutRate * 0.62 +
    telemetry.lowBandStallRate * 0.18 +
    telemetry.averageDrySpellRatio * 0.32 +
    (1 - telemetry.averageClearRate) * 0.18 +
    Math.max(0, 0.45 - telemetry.averageBoardFillOnDeath) * 0.25,
    0,
    1,
  );
  const telemetryBoardAssist = clamp(
    telemetry.boardLockRate * 0.58 +
    telemetry.averageBoardFillOnDeath * 0.42 +
    telemetry.averagePeakBoardFill * 0.22 +
    telemetry.averageDrySpellRatio * 0.2 +
    telemetry.lowBandStallRate * 0.16 -
    telemetry.averageClearRate * 0.12,
    0,
    1,
  );

  const assist = clamp(
    0.15 * onboarding +
    0.72 * struggle +
    0.32 * stagnating -
    0.24 * strong +
    telemetryConfidence * (telemetry.lowBandStallRate * 0.22 + telemetry.averageDrySpellRatio * 0.1 - telemetryMastery * 0.06),
    0,
    1,
  );
  const timerAssist = clamp(
    assist * 0.58 +
    timeoutStruggle * 0.7 -
    strong * 0.12 +
    telemetryConfidence * (telemetryTimerAssist * 0.42 - telemetryMastery * 0.06),
    0,
    1,
  );
  const boardAssist = clamp(
    assist * 0.42 +
    boardStruggle * 0.82 -
    strong * 0.1 +
    telemetryConfidence * (telemetryBoardAssist * 0.46 - telemetryMastery * 0.05),
    0,
    1,
  );
  const mastery = clamp(
    (recentTier / Math.max(tiers.length - 1, 1)) * 0.45 + strong * 0.35 - struggle * 0.1,
    0,
    1,
  );
  const tunedMastery = clamp(
    mastery + telemetryConfidence * (telemetryMastery * 0.32 - telemetry.lowBandStallRate * 0.08),
    0,
    1,
  );

  return {
    openingGraceMultiplier: clamp(1 + timerAssist * 0.42 + assist * 0.08 - tunedMastery * 0.08, 0.92, 1.45),
    basePressureMultiplier: clamp(1 - timerAssist * 0.24 + tunedMastery * 0.06, 0.78, 1.08),
    recoveryMultiplier: clamp(1 + timerAssist * 0.82 + assist * 0.12 - tunedMastery * 0.08, 0.95, 1.85),
    unlockDelayMultiplier: clamp(1 + boardAssist * 0.68 + assist * 0.1 - tunedMastery * 0.18, 0.92, 1.65),
    rescueWeightMultiplier: clamp(1 + boardAssist * 0.92 + assist * 0.1 - tunedMastery * 0.08, 0.95, 2.1),
    threatWeightMultiplier: clamp(1 - boardAssist * 0.55 + tunedMastery * 0.12, 0.58, 1.12),
  };
}

export function getAdaptiveTuning(difficulty: Difficulty): AdaptiveTuning {
  try {
    const profile = readProfile();
    return deriveTuning(difficulty, profile[difficulty]);
  } catch {
    return DEFAULT_ADAPTIVE_TUNING;
  }
}

export function recordAdaptiveRun(difficulty: Difficulty, summary: RunSummary): void {
  try {
    recordRunTelemetry(difficulty, summary);
    const profile = readProfile();
    const difficultyProfile = profile[difficulty];
    const nextBest = Math.max(difficultyProfile.bestScore, summary.score);
    const struggleThreshold = getStruggleThreshold(difficulty, nextBest);
    const strongThreshold = getStrongThreshold(difficulty, nextBest);

    difficultyProfile.totalRuns += 1;
    difficultyProfile.bestScore = nextBest;
    difficultyProfile.recentScores.push(summary.score);
    if (difficultyProfile.recentScores.length > MAX_RECENT_SCORES) {
      difficultyProfile.recentScores.splice(0, difficultyProfile.recentScores.length - MAX_RECENT_SCORES);
    }
    difficultyProfile.recentEndCauses.push(summary.endCause);
    if (difficultyProfile.recentEndCauses.length > MAX_RECENT_SCORES) {
      difficultyProfile.recentEndCauses.splice(0, difficultyProfile.recentEndCauses.length - MAX_RECENT_SCORES);
    }

    if (summary.score <= struggleThreshold) {
      difficultyProfile.consecutiveStruggleRuns += 1;
    } else {
      difficultyProfile.consecutiveStruggleRuns = 0;
    }

    if (summary.score >= strongThreshold) {
      difficultyProfile.consecutiveStrongRuns += 1;
    } else {
      difficultyProfile.consecutiveStrongRuns = 0;
    }

    if (summary.endCause === 'timeout') {
      difficultyProfile.consecutiveTimeoutRuns += 1;
    } else {
      difficultyProfile.consecutiveTimeoutRuns = 0;
    }

    if (summary.endCause === 'board_lock') {
      difficultyProfile.consecutiveBoardLockRuns += 1;
    } else {
      difficultyProfile.consecutiveBoardLockRuns = 0;
    }

    profile[difficulty] = difficultyProfile;
    writeProfile(profile);
  } catch {
    /* */
  }
}
