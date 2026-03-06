import { AdaptiveTuning, DEFAULT_ADAPTIVE_TUNING } from './AdaptiveProgression';
import { Difficulty } from './Config';

interface RunPhase {
  minScore: number;
  drainMultiplier: number;
  drainAccelMultiplier: number;
  timeBonusMultiplier: number;
}

interface RunPacingConfig {
  graceSeconds: number;
  graceStartDrainMultiplier: number;
  drySpellMoveThreshold: number;
  drySpellDrainMultiplier: number;
  drySpellTimeBonusMultiplier: number;
  lowTimeThresholdFraction: number;
  lowTimeDrainMultiplier: number;
  lowTimeTimeBonusBoost: number;
  phases: RunPhase[];
}

export interface RunPacingState {
  phaseIndex: number;
  drainMultiplier: number;
  drainAccelMultiplier: number;
  timeBonusMultiplier: number;
  recoveryActive: boolean;
}

const RUN_PACING: Record<Difficulty, RunPacingConfig> = {
  chill: {
    graceSeconds: 26,
    graceStartDrainMultiplier: 0.66,
    drySpellMoveThreshold: 4,
    drySpellDrainMultiplier: 0.82,
    drySpellTimeBonusMultiplier: 1.24,
    lowTimeThresholdFraction: 0.18,
    lowTimeDrainMultiplier: 0.8,
    lowTimeTimeBonusBoost: 0.24,
    phases: [
      { minScore: 0, drainMultiplier: 0.8, drainAccelMultiplier: 0.16, timeBonusMultiplier: 1.26 },
      { minScore: 2500, drainMultiplier: 0.88, drainAccelMultiplier: 0.4, timeBonusMultiplier: 1.14 },
      { minScore: 7000, drainMultiplier: 0.96, drainAccelMultiplier: 0.68, timeBonusMultiplier: 1.04 },
      { minScore: 15000, drainMultiplier: 1.04, drainAccelMultiplier: 0.95, timeBonusMultiplier: 0.96 },
      { minScore: 30000, drainMultiplier: 1.1, drainAccelMultiplier: 1.05, timeBonusMultiplier: 0.92 },
    ],
  },
  fast: {
    graceSeconds: 18,
    graceStartDrainMultiplier: 0.78,
    drySpellMoveThreshold: 2,
    drySpellDrainMultiplier: 0.84,
    drySpellTimeBonusMultiplier: 1.16,
    lowTimeThresholdFraction: 0.24,
    lowTimeDrainMultiplier: 0.82,
    lowTimeTimeBonusBoost: 0.18,
    phases: [
      { minScore: 0, drainMultiplier: 0.88, drainAccelMultiplier: 0.18, timeBonusMultiplier: 1.18 },
      { minScore: 2500, drainMultiplier: 0.96, drainAccelMultiplier: 0.42, timeBonusMultiplier: 1.08 },
      { minScore: 7500, drainMultiplier: 1.02, drainAccelMultiplier: 0.72, timeBonusMultiplier: 1.0 },
      { minScore: 15000, drainMultiplier: 1.08, drainAccelMultiplier: 0.96, timeBonusMultiplier: 0.95 },
      { minScore: 25000, drainMultiplier: 1.14, drainAccelMultiplier: 1.12, timeBonusMultiplier: 0.9 },
    ],
  },
  blitz: {
    graceSeconds: 10,
    graceStartDrainMultiplier: 0.9,
    drySpellMoveThreshold: 2,
    drySpellDrainMultiplier: 0.88,
    drySpellTimeBonusMultiplier: 1.1,
    lowTimeThresholdFraction: 0.22,
    lowTimeDrainMultiplier: 0.86,
    lowTimeTimeBonusBoost: 0.12,
    phases: [
      { minScore: 0, drainMultiplier: 0.94, drainAccelMultiplier: 0.28, timeBonusMultiplier: 1.16 },
      { minScore: 1200, drainMultiplier: 1.03, drainAccelMultiplier: 0.58, timeBonusMultiplier: 1.06 },
      { minScore: 3500, drainMultiplier: 1.1, drainAccelMultiplier: 0.88, timeBonusMultiplier: 0.98 },
      { minScore: 7000, drainMultiplier: 1.18, drainAccelMultiplier: 1.1, timeBonusMultiplier: 0.9 },
      { minScore: 12000, drainMultiplier: 1.24, drainAccelMultiplier: 1.22, timeBonusMultiplier: 0.84 },
    ],
  },
};

export function getRunPacing(
  difficulty: Difficulty,
  score: number,
  gameElapsed: number,
  movesSinceLastClear: number,
  timeRemainingFraction: number,
  adaptiveTuning: AdaptiveTuning = DEFAULT_ADAPTIVE_TUNING,
): RunPacingState {
  const config = RUN_PACING[difficulty];
  const graceSeconds = config.graceSeconds * adaptiveTuning.openingGraceMultiplier;

  let phaseIndex = 0;
  for (let i = 0; i < config.phases.length; i++) {
    if (score >= config.phases[i].minScore) {
      phaseIndex = i;
    } else {
      break;
    }
  }

  const phase = config.phases[phaseIndex];
  let drainMultiplier = phase.drainMultiplier * adaptiveTuning.basePressureMultiplier;
  let drainAccelMultiplier = phase.drainAccelMultiplier;
  let timeBonusMultiplier =
    phase.timeBonusMultiplier * (1 + (1 - adaptiveTuning.basePressureMultiplier) * 0.65);
  let recoveryActive = false;

  if (gameElapsed < graceSeconds) {
    const t = Math.max(0, Math.min(gameElapsed / graceSeconds, 1));
    drainMultiplier =
      config.graceStartDrainMultiplier + (drainMultiplier - config.graceStartDrainMultiplier) * t;
    drainAccelMultiplier *= t;
    timeBonusMultiplier = Math.max(timeBonusMultiplier, 1.12 - t * 0.05);
  }

  if (movesSinceLastClear >= config.drySpellMoveThreshold) {
    recoveryActive = true;
    const drySpellDrainMultiplier = Math.max(
      0.58,
      1 - (1 - config.drySpellDrainMultiplier) * adaptiveTuning.recoveryMultiplier,
    );
    drainMultiplier *= drySpellDrainMultiplier;
    timeBonusMultiplier *= 1 + (config.drySpellTimeBonusMultiplier - 1) * adaptiveTuning.recoveryMultiplier;
  }

  if (timeRemainingFraction <= config.lowTimeThresholdFraction) {
    recoveryActive = true;
    const panicT = 1 - Math.max(timeRemainingFraction, 0) / config.lowTimeThresholdFraction;
    const drainRelief = 1 - (1 - config.lowTimeDrainMultiplier) * panicT;
    drainMultiplier *= drainRelief;
    timeBonusMultiplier *= 1 + config.lowTimeTimeBonusBoost * panicT * adaptiveTuning.recoveryMultiplier;
  }

  return {
    phaseIndex,
    drainMultiplier,
    drainAccelMultiplier,
    timeBonusMultiplier,
    recoveryActive,
  };
}
