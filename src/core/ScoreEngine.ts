import { ScoringConfig, TimerConfig, SpeedConfig } from './Config';
import { ClearResult, ScoreBreakdown } from './types';

export class ScoreEngine {
  private scoring: ScoringConfig;
  private timer: TimerConfig;
  private speed: SpeedConfig;

  constructor(scoring: ScoringConfig, timer: TimerConfig, speed: SpeedConfig) {
    this.scoring = scoring;
    this.timer = timer;
    this.speed = speed;
  }

  /** Get speed multiplier based on elapsed seconds since last placement */
  getSpeedMultiplier(elapsedSecs: number): number {
    const { maxMultiplier, minMultiplier, decayWindowSeconds } = this.speed;
    const t = Math.min(elapsedSecs / decayWindowSeconds, 1);
    return maxMultiplier - (maxMultiplier - minMultiplier) * t;
  }

  /** Calculate score for a single turn (clears only — no placement points) */
  calculate(
    clearResult: ClearResult,
    streakCount: number,
    isBoardClear: boolean,
    speedMultiplier: number = 1,
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

    // Final score: streak × speed
    let turnScore: number;
    if (cfg.streakBonusAppliesTo === 'base+combo') {
      turnScore = Math.floor((basePoints + lineBonus) * streakMultiplier * speedMultiplier);
    } else {
      turnScore = Math.floor(basePoints * streakMultiplier * speedMultiplier) + lineBonus;
    }

    return {
      basePoints,
      lineBonus,
      streakMultiplier,
      speedMultiplier,
      turnScore,
      totalScore: 0, // filled by GameState
    };
  }

  /** Calculate time bonus for a placement + clear */
  calculateTimeBonus(
    linesCleared: number,
    isBoardClear: boolean,
    streakCount: number,
  ): number {
    const cfg = this.timer;
    let bonus = cfg.piecePlaceBonus;

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

    return bonus;
  }
}
