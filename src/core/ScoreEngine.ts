import { ScoringConfig, TimerConfig } from './Config';
import { ClearResult, ScoreBreakdown } from './types';

export class ScoreEngine {
  private scoring: ScoringConfig;
  private timer: TimerConfig;

  constructor(scoring: ScoringConfig, timer: TimerConfig) {
    this.scoring = scoring;
    this.timer = timer;
  }

  /** Speed fraction: 1.0 at instant placement, decays to minTimeBonusFraction */
  getSpeedFraction(elapsedSecs: number): number {
    const { speedWindowSeconds, minTimeBonusFraction } = this.timer;
    const t = Math.min(elapsedSecs / speedWindowSeconds, 1);
    return 1 - (1 - minTimeBonusFraction) * t;
  }

  /** Calculate score for a single turn (clears only — no speed multiplier on score) */
  calculate(
    clearResult: ClearResult,
    streakCount: number,
    isBoardClear: boolean,
  ): ScoreBreakdown {
    const cfg = this.scoring;

    // Base points: per-block destroyed + per-line cleared
    const blockPoints = clearResult.totalCellsRemoved * cfg.pointsPerBlockCleared;
    const linePoints = clearResult.totalLinesCleared * cfg.pointsPerLineCleared;
    const basePoints = blockPoints + linePoints;

    // Line bonus: combo bonus for simultaneous multi-line clears
    let lineBonus = 0;
    if (clearResult.totalLinesCleared > 0) {
      lineBonus = Math.min(
        cfg.comboBaseBonus + cfg.comboBonusPerExtraLine * Math.max(clearResult.totalLinesCleared - 1, 0),
        cfg.comboBonusCap,
      );
    }

    // Board clear bonus
    if (isBoardClear) {
      lineBonus += cfg.boardClearBonus;
    }

    // Streak multiplier
    const streakMultiplier = Math.min(
      cfg.streakMultiplierBase + streakCount * cfg.streakMultiplierIncrement,
      cfg.streakMultiplierCap,
    );

    // Final score: streak only (speed affects time, not score)
    let turnScore: number;
    if (cfg.streakBonusAppliesTo === 'base+combo') {
      turnScore = Math.floor((basePoints + lineBonus) * streakMultiplier);
    } else {
      turnScore = Math.floor(basePoints * streakMultiplier) + lineBonus;
    }

    return {
      basePoints,
      lineBonus,
      streakMultiplier,
      turnScore,
      totalScore: 0, // filled by GameState
    };
  }

  /** Calculate time bonus for a placement + clear, scaled by speed */
  calculateTimeBonus(
    linesCleared: number,
    isBoardClear: boolean,
    streakCount: number,
    speedFraction: number,
  ): number {
    const cfg = this.timer;

    // Base time bonus for placement
    let bonus = cfg.piecePlaceBonus;

    // Clear bonuses
    if (linesCleared === 1) {
      bonus += cfg.clear1LineBonus;
    } else if (linesCleared === 2) {
      bonus += cfg.clear2LineBonus;
    } else if (linesCleared >= 3) {
      bonus += cfg.clear3PlusLineBonus;
    }

    if (isBoardClear) {
      bonus += cfg.boardClearBonus;
    }

    // Streak bonus: extra time per streak level
    if (linesCleared > 0 && streakCount > 0) {
      bonus += streakCount * cfg.streakBonusPerLevel;
    }

    // Scale entire bonus by speed fraction
    return Math.round(bonus * speedFraction * 10) / 10;
  }
}
