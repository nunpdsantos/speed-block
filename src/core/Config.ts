export interface ScoringConfig {
  pointsPerBlockCleared: number;
  pointsPerLineCleared: number;
  placementPointsPerCell: number;
  comboBaseBonus: number;
  comboBonusPerExtraLine: number;
  comboBonusCap: number;
  streakMultiplierBase: number;
  streakMultiplierIncrement: number;
  streakMultiplierCap: number;
  comboWindowPlacements: number;
  boardClearBonus: number;
  streakBonusAppliesTo: 'base+combo' | 'base_only';
  // Speed bonus: the faster you place, the more points
  speedBonusMaxMultiplier: number;   // e.g. 4.0 = up to 4x at instant speed
  speedBonusDecayPerSecond: number;  // how fast the multiplier decays toward min
  speedBonusMinMultiplier: number;   // floor (typically 1.0 = no penalty for slow)
  // Speed streak: consecutive fast placements compound
  speedStreakThreshold: number;      // seconds — placement faster than this counts as "fast"
  speedStreakBonus: number;          // extra multiplier added per consecutive fast placement
  speedStreakCap: number;            // max extra multiplier from speed streak
}

export interface GenerationConfig {
  ensureLegalPlacement: boolean;
  maxRerollAttempts: number;
}

export interface GameConfig {
  scoring: ScoringConfig;
  generation: GenerationConfig;
}

export const DEFAULT_CONFIG: GameConfig = {
  scoring: {
    pointsPerBlockCleared: 10,
    pointsPerLineCleared: 0,
    placementPointsPerCell: 0,
    comboBaseBonus: 20,
    comboBonusPerExtraLine: 10,
    comboBonusCap: 100,
    streakMultiplierBase: 1.0,
    streakMultiplierIncrement: 0.5,
    streakMultiplierCap: 8.0,
    comboWindowPlacements: 3,
    boardClearBonus: 500,
    streakBonusAppliesTo: 'base+combo',
    speedBonusMaxMultiplier: 4.0,
    speedBonusDecayPerSecond: 0.375,  // 4.0 → 1.0 over 8 seconds
    speedBonusMinMultiplier: 1.0,
    speedStreakThreshold: 4,          // under 4s = "fast" placement
    speedStreakBonus: 0.5,            // +0.5x per consecutive fast placement
    speedStreakCap: 2.0,              // max +2.0x from speed streak (so 4x + 2x = 6x theoretical max)
  },
  generation: {
    ensureLegalPlacement: true,
    maxRerollAttempts: 20,
  },
};
