import { Difficulty } from './Config';
import { getProgressStatus, getProgressTiers } from './Progression';
import { RunSummary } from './types';

const STORAGE_KEY = 'speedblock_run_telemetry_v1';
const MAX_RECENT_RUNS = 12;

export interface TelemetryRunEntry extends RunSummary {
  recordedAt: string;
  scoreBandIndex: number;
  scoreBandLabel: string;
  clearRate: number;
  drySpellRatio: number;
}

interface DifficultyTelemetryProfile {
  totalRuns: number;
  recentRuns: TelemetryRunEntry[];
  bandRunCounts: number[];
}

type TelemetryProfile = Record<Difficulty, DifficultyTelemetryProfile>;

export interface TelemetryTuningSignal {
  sampleSize: number;
  timeoutRate: number;
  boardLockRate: number;
  lowBandStallRate: number;
  averageDrySpellRatio: number;
  averageBoardFillOnDeath: number;
  averagePeakBoardFill: number;
  averageClearRate: number;
  recentMedianBand: number;
  bestObservedBand: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function createDifficultyTelemetryProfile(difficulty: Difficulty): DifficultyTelemetryProfile {
  return {
    totalRuns: 0,
    recentRuns: [],
    bandRunCounts: new Array(getProgressTiers(difficulty).length).fill(0),
  };
}

function createTelemetryProfile(): TelemetryProfile {
  return {
    chill: createDifficultyTelemetryProfile('chill'),
    fast: createDifficultyTelemetryProfile('fast'),
    blitz: createDifficultyTelemetryProfile('blitz'),
  };
}

function normalizeDifficultyTelemetryProfile(
  difficulty: Difficulty,
  profile?: Partial<DifficultyTelemetryProfile>,
): DifficultyTelemetryProfile {
  const base = createDifficultyTelemetryProfile(difficulty);
  const recentRuns = Array.isArray(profile?.recentRuns) ? profile.recentRuns : [];
  const parsedBandRunCounts = Array.isArray(profile?.bandRunCounts) ? profile.bandRunCounts : [];

  return {
    totalRuns: typeof profile?.totalRuns === 'number' ? profile.totalRuns : base.totalRuns,
    recentRuns: recentRuns.slice(-MAX_RECENT_RUNS),
    bandRunCounts: base.bandRunCounts.map((_, index) => parsedBandRunCounts[index] ?? 0),
  };
}

function readTelemetryProfile(): TelemetryProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createTelemetryProfile();
    const parsed = JSON.parse(raw) as Partial<TelemetryProfile>;
    return {
      chill: normalizeDifficultyTelemetryProfile('chill', parsed.chill),
      fast: normalizeDifficultyTelemetryProfile('fast', parsed.fast),
      blitz: normalizeDifficultyTelemetryProfile('blitz', parsed.blitz),
    };
  } catch {
    return createTelemetryProfile();
  }
}

function writeTelemetryProfile(profile: TelemetryProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    /* */
  }
}

function createRunEntry(difficulty: Difficulty, summary: RunSummary): TelemetryRunEntry {
  const progress = getProgressStatus(difficulty, summary.score);
  const clearRate = summary.totalTurns > 0 ? summary.clearTurns / summary.totalTurns : 0;
  const drySpellRatio = summary.totalTurns > 0 ? summary.maxDrySpell / summary.totalTurns : 0;

  return {
    ...summary,
    recordedAt: new Date().toISOString(),
    scoreBandIndex: progress.tierIndex,
    scoreBandLabel: progress.current.label,
    clearRate,
    drySpellRatio: clamp(drySpellRatio, 0, 1),
  };
}

export function recordRunTelemetry(difficulty: Difficulty, summary: RunSummary): void {
  try {
    const profile = readTelemetryProfile();
    const difficultyProfile = profile[difficulty];
    const entry = createRunEntry(difficulty, summary);

    difficultyProfile.totalRuns += 1;
    difficultyProfile.recentRuns.push(entry);
    if (difficultyProfile.recentRuns.length > MAX_RECENT_RUNS) {
      difficultyProfile.recentRuns.splice(0, difficultyProfile.recentRuns.length - MAX_RECENT_RUNS);
    }
    difficultyProfile.bandRunCounts[entry.scoreBandIndex] =
      (difficultyProfile.bandRunCounts[entry.scoreBandIndex] ?? 0) + 1;

    profile[difficulty] = difficultyProfile;
    writeTelemetryProfile(profile);
  } catch {
    /* */
  }
}

export function getTelemetryTuningSignal(difficulty: Difficulty): TelemetryTuningSignal {
  try {
    const difficultyProfile = readTelemetryProfile()[difficulty];
    const recentRuns = difficultyProfile.recentRuns;
    const tiers = getProgressTiers(difficulty);

    if (recentRuns.length === 0) {
      return {
        sampleSize: 0,
        timeoutRate: 0,
        boardLockRate: 0,
        lowBandStallRate: 0,
        averageDrySpellRatio: 0,
        averageBoardFillOnDeath: 0,
        averagePeakBoardFill: 0,
        averageClearRate: 0,
        recentMedianBand: 0,
        bestObservedBand: 0,
      };
    }

    const lowBandCutoff = Math.min(1, tiers.length - 1);
    const timeoutRate = recentRuns.filter(run => run.endCause === 'timeout').length / recentRuns.length;
    const boardLockRate = recentRuns.filter(run => run.endCause === 'board_lock').length / recentRuns.length;
    const lowBandStallRate =
      recentRuns.filter(run => run.scoreBandIndex <= lowBandCutoff).length / recentRuns.length;
    const bandSamples = recentRuns.map(run => run.scoreBandIndex);
    const bestObservedBand = difficultyProfile.bandRunCounts.reduce(
      (bestIndex, count, index) => (count > 0 ? index : bestIndex),
      0,
    );

    return {
      sampleSize: recentRuns.length,
      timeoutRate,
      boardLockRate,
      lowBandStallRate,
      averageDrySpellRatio: average(recentRuns.map(run => run.drySpellRatio)),
      averageBoardFillOnDeath: average(recentRuns.map(run => run.boardFillFraction)),
      averagePeakBoardFill: average(recentRuns.map(run => run.peakBoardFillFraction)),
      averageClearRate: average(recentRuns.map(run => run.clearRate)),
      recentMedianBand: median(bandSamples),
      bestObservedBand,
    };
  } catch {
    return {
      sampleSize: 0,
      timeoutRate: 0,
      boardLockRate: 0,
      lowBandStallRate: 0,
      averageDrySpellRatio: 0,
      averageBoardFillOnDeath: 0,
      averagePeakBoardFill: 0,
      averageClearRate: 0,
      recentMedianBand: 0,
      bestObservedBand: 0,
    };
  }
}
