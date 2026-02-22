export type Difficulty = 'chill' | 'fast' | 'blitz';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  chill: 'CHILL',
  fast: 'FAST',
  blitz: 'BLITZ',
};

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
    scoring: SHARED_SCORING,
    timer: {
      startSeconds: 60,
      maxSeconds: 75,
      piecePlaceBonus: 2.5,
      clear1LineBonus: 4,
      clear2LineBonus: 7,
      clear3PlusLineBonus: 10,
      boardClearBonus: 15,
      streakBonusPerLevel: 1,
      speedWindowSeconds: 6,
      minTimeBonusFraction: 0.25,
      drainAccelPerMinute: 0.20,
    },
    generation: SHARED_GENERATION,
  },
  fast: {
    scoring: SHARED_SCORING,
    timer: {
      startSeconds: 45,
      maxSeconds: 55,
      piecePlaceBonus: 2,
      clear1LineBonus: 3,
      clear2LineBonus: 5,
      clear3PlusLineBonus: 7,
      boardClearBonus: 10,
      streakBonusPerLevel: 1,
      speedWindowSeconds: 5,
      minTimeBonusFraction: 0.20,
      drainAccelPerMinute: 0.30,
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
