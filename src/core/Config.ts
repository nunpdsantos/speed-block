export interface ScoringConfig {
  pointsPerBlockCleared: number;
  pointsPerLineCleared: number;
  comboBaseBonus: number;
  comboBonusPerExtraLine: number;
  comboBonusCap: number;
  streakMultiplierBase: number;
  streakMultiplierIncrement: number;
  streakMultiplierCap: number;
  comboWindowPlacements: number;
  boardClearBonus: number;
  streakBonusAppliesTo: 'base+combo' | 'base_only';
}

export interface TimerConfig {
  startSeconds: number;          // initial time bank
  maxSeconds: number;            // cap so timer can't grow forever
  piecePlaceBonus: number;       // max seconds added per piece placed (at instant speed)
  clear1LineBonus: number;       // seconds added for clearing 1 line
  clear2LineBonus: number;       // seconds added for clearing 2 lines simultaneously
  clear3PlusLineBonus: number;   // seconds added for clearing 3+ lines
  boardClearBonus: number;       // seconds added for clearing the entire board
  streakBonusPerLevel: number;   // extra seconds per streak level on a clear
  // Speed → time scaling
  speedWindowSeconds: number;    // seconds until speed bonus fully decays
  minTimeBonusFraction: number;  // floor fraction of time bonus at slowest (e.g. 0.33 = 1/3)
  // Drain acceleration
  drainAccelPerMinute: number;   // how much drain rate increases per minute survived
}

export interface GenerationConfig {
  ensureLegalPlacement: boolean;
  maxRerollAttempts: number;
}

export interface GameConfig {
  scoring: ScoringConfig;
  timer: TimerConfig;
  generation: GenerationConfig;
}

export const DEFAULT_CONFIG: GameConfig = {
  scoring: {
    pointsPerBlockCleared: 10,
    pointsPerLineCleared: 0,
    comboBaseBonus: 20,
    comboBonusPerExtraLine: 10,
    comboBonusCap: 100,
    streakMultiplierBase: 1.0,
    streakMultiplierIncrement: 0.5,
    streakMultiplierCap: 8.0,
    comboWindowPlacements: 3,
    boardClearBonus: 500,
    streakBonusAppliesTo: 'base+combo',
  },
  timer: {
    startSeconds: 60,
    maxSeconds: 90,
    piecePlaceBonus: 3,
    clear1LineBonus: 4,
    clear2LineBonus: 7,
    clear3PlusLineBonus: 10,
    boardClearBonus: 15,
    streakBonusPerLevel: 1,
    speedWindowSeconds: 8,
    minTimeBonusFraction: 0.33,
    drainAccelPerMinute: 0.15,
  },
  generation: {
    ensureLegalPlacement: true,
    maxRerollAttempts: 20,
  },
};
