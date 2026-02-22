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
  piecePlaceBonus: number;       // seconds added per piece placed
  clear1LineBonus: number;       // seconds added for clearing 1 line
  clear2LineBonus: number;       // seconds added for clearing 2 lines simultaneously
  clear3PlusLineBonus: number;   // seconds added for clearing 3+ lines
  boardClearBonus: number;       // seconds added for clearing the entire board
  streakBonusPerLevel: number;   // extra seconds per streak level on a clear
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
  },
  generation: {
    ensureLegalPlacement: true,
    maxRerollAttempts: 20,
  },
};
