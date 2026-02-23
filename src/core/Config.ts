export type Difficulty = 'chill' | 'fast' | 'blitz';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  chill: 'CHILL',
  fast: 'FAST',
  blitz: 'BLITZ',
};

export interface ScoringConfig {
  pointsPerBlockPlaced: number;
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
  startSeconds: number;
  maxSeconds: number;
  piecePlaceBonus: number;
  clear1LineBonus: number;
  clear2LineBonus: number;
  clear3PlusLineBonus: number;
  boardClearBonus: number;
  streakBonusPerLevel: number;
  speedWindowSeconds: number;
  minTimeBonusFraction: number;
  drainAccelPerMinute: number;
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

const SHARED_SCORING: ScoringConfig = {
  pointsPerBlockPlaced: 1,
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
};

const SHARED_GENERATION: GenerationConfig = {
  ensureLegalPlacement: true,
  maxRerollAttempts: 20,
};

export const DIFFICULTY_CONFIGS: Record<Difficulty, GameConfig> = {
  chill: {
    scoring: { ...SHARED_SCORING, comboWindowPlacements: 5 },
    timer: {
      startSeconds: 90,
      maxSeconds: 120,
      piecePlaceBonus: 3.5,
      clear1LineBonus: 6,
      clear2LineBonus: 10,
      clear3PlusLineBonus: 14,
      boardClearBonus: 20,
      streakBonusPerLevel: 1,
      speedWindowSeconds: 10,
      minTimeBonusFraction: 0.50,
      drainAccelPerMinute: 0.08,
    },
    generation: SHARED_GENERATION,
  },
  fast: {
    scoring: { ...SHARED_SCORING, comboWindowPlacements: 4 },
    timer: {
      startSeconds: 60,
      maxSeconds: 80,
      piecePlaceBonus: 2.5,
      clear1LineBonus: 4,
      clear2LineBonus: 7,
      clear3PlusLineBonus: 9.5,
      boardClearBonus: 14,
      streakBonusPerLevel: 1,
      speedWindowSeconds: 7,
      minTimeBonusFraction: 0.30,
      drainAccelPerMinute: 0.24,
    },
    generation: SHARED_GENERATION,
  },
  blitz: {
    scoring: SHARED_SCORING,
    timer: {
      startSeconds: 30,
      maxSeconds: 40,
      piecePlaceBonus: 1.5,
      clear1LineBonus: 2,
      clear2LineBonus: 3.5,
      clear3PlusLineBonus: 5,
      boardClearBonus: 8,
      streakBonusPerLevel: 1,
      speedWindowSeconds: 4,
      minTimeBonusFraction: 0.15,
      drainAccelPerMinute: 0.40,
    },
    generation: SHARED_GENERATION,
  },
};

export const DEFAULT_CONFIG = DIFFICULTY_CONFIGS.chill;
