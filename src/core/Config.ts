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
  // Speed bonus: the faster you clear, the more points
  speedBonusMaxMultiplier: number;   // e.g. 2.0 = up to 2x at instant speed
  speedBonusDecayPerSecond: number;  // how fast the multiplier decays toward 1.0
  speedBonusMinMultiplier: number;   // floor (typically 1.0 = no penalty for slow)
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
    speedBonusMaxMultiplier: 2.0,
    speedBonusDecayPerSecond: 0.1,
    speedBonusMinMultiplier: 1.0,
  },
  generation: {
    ensureLegalPlacement: true,
    maxRerollAttempts: 20,
  },
};
