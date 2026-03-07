import { Difficulty } from './Config';

interface DifficultyRamp {
  ceilingScore: number;
  floorDrain: number;
  ceilingDrain: number;
  floorDrainAccel: number;
  ceilingDrainAccel: number;
  floorTimeBonus: number;
  ceilingTimeBonus: number;
  graceSeconds: number;
  graceStartDrainMultiplier: number;
  drySpellMoveThreshold: number;
  drySpellDrainMultiplier: number;
  drySpellTimeBonusMultiplier: number;
  lowTimeThresholdFraction: number;
  lowTimeDrainMultiplier: number;
  lowTimeTimeBonusBoost: number;
  /** Floor for the time-based drain acceleration cap (applied at score 0) */
  timeAccelCapFloor: number;
  /** Additional cap range added as score progresses toward ceiling */
  timeAccelCapRange: number;
}

export interface RunPacingState {
  drainMultiplier: number;
  drainAccelMultiplier: number;
  timeBonusMultiplier: number;
  recoveryActive: boolean;
  /** Maximum additive time-based drain acceleration allowed at current score */
  timeAccelCap: number;
}

const RAMPS: Record<Difficulty, DifficultyRamp> = {
  chill: {
    ceilingScore: 40000,
    floorDrain: 0.80, ceilingDrain: 1.12,
    floorDrainAccel: 0.15, ceilingDrainAccel: 1.10,
    floorTimeBonus: 1.25, ceilingTimeBonus: 0.90,
    graceSeconds: 22,
    graceStartDrainMultiplier: 0.70,
    drySpellMoveThreshold: 3,
    drySpellDrainMultiplier: 0.75,
    drySpellTimeBonusMultiplier: 1.25,
    lowTimeThresholdFraction: 0.25,
    lowTimeDrainMultiplier: 0.78,
    lowTimeTimeBonusBoost: 0.26,
    timeAccelCapFloor: 0.05,
    timeAccelCapRange: 0.25,
  },
  fast: {
    ceilingScore: 30000,
    floorDrain: 0.86, ceilingDrain: 1.16,
    floorDrainAccel: 0.15, ceilingDrainAccel: 1.15,
    floorTimeBonus: 1.20, ceilingTimeBonus: 0.88,
    graceSeconds: 18,
    graceStartDrainMultiplier: 0.78,
    drySpellMoveThreshold: 2,
    drySpellDrainMultiplier: 0.78,
    drySpellTimeBonusMultiplier: 1.20,
    lowTimeThresholdFraction: 0.28,
    lowTimeDrainMultiplier: 0.80,
    lowTimeTimeBonusBoost: 0.22,
    timeAccelCapFloor: 0.05,
    timeAccelCapRange: 0.25,
  },
  blitz: {
    ceilingScore: 20000,
    floorDrain: 0.94, ceilingDrain: 1.22,
    floorDrainAccel: 0.20, ceilingDrainAccel: 1.20,
    floorTimeBonus: 1.14, ceilingTimeBonus: 0.86,
    graceSeconds: 12,
    graceStartDrainMultiplier: 0.86,
    drySpellMoveThreshold: 2,
    drySpellDrainMultiplier: 0.82,
    drySpellTimeBonusMultiplier: 1.16,
    lowTimeThresholdFraction: 0.32,
    lowTimeDrainMultiplier: 0.84,
    lowTimeTimeBonusBoost: 0.18,
    timeAccelCapFloor: 0.06,
    timeAccelCapRange: 0.24,
  },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function getRunPacing(
  difficulty: Difficulty,
  score: number,
  gameElapsed: number,
  movesSinceLastClear: number,
  timeRemainingFraction: number,
): RunPacingState {
  const ramp = RAMPS[difficulty];

  // Continuous interpolation: t = (score / ceiling) ^ 0.55
  const rawT = Math.min(score / ramp.ceilingScore, 1);
  const t = Math.pow(rawT, 0.55);

  let drainMultiplier = lerp(ramp.floorDrain, ramp.ceilingDrain, t);
  let drainAccelMultiplier = lerp(ramp.floorDrainAccel, ramp.ceilingDrainAccel, t);
  let timeBonusMultiplier = lerp(ramp.floorTimeBonus, ramp.ceilingTimeBonus, t);
  let recoveryActive = false;

  // Score-based cap on time acceleration: prevents long low-score runs from being punished
  const timeAccelCap = ramp.timeAccelCapFloor + t * ramp.timeAccelCapRange;

  // Opening grace: ease into full drain over the first N seconds
  if (gameElapsed < ramp.graceSeconds) {
    const graceT = Math.min(gameElapsed / ramp.graceSeconds, 1);
    drainMultiplier = ramp.graceStartDrainMultiplier +
      (drainMultiplier - ramp.graceStartDrainMultiplier) * graceT;
    drainAccelMultiplier *= graceT;
    timeBonusMultiplier = Math.max(timeBonusMultiplier, 1.12 - graceT * 0.05);
  }

  // Dry-spell recovery: ease drain when player can't clear
  if (movesSinceLastClear >= ramp.drySpellMoveThreshold) {
    recoveryActive = true;
    drainMultiplier *= ramp.drySpellDrainMultiplier;
    timeBonusMultiplier *= ramp.drySpellTimeBonusMultiplier;
  }

  // Low-time recovery: slight relief when near death
  if (timeRemainingFraction <= ramp.lowTimeThresholdFraction) {
    recoveryActive = true;
    const panicT = 1 - Math.max(timeRemainingFraction, 0) / ramp.lowTimeThresholdFraction;
    drainMultiplier *= 1 - (1 - ramp.lowTimeDrainMultiplier) * panicT;
    timeBonusMultiplier *= 1 + ramp.lowTimeTimeBonusBoost * panicT;
  }

  return { drainMultiplier, drainAccelMultiplier, timeBonusMultiplier, recoveryActive, timeAccelCap };
}
