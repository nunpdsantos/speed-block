import { ScoringConfig } from './Config';
import { ClearResult, ScoreBreakdown } from './types';

export class ScoreEngine {
  private config: ScoringConfig;

  constructor(config: ScoringConfig) {
    this.config = config;
  }

  /** Calculate speed multiplier based on elapsed seconds since last piece placement */
  getSpeedMultiplier(elapsedSeconds: number): number {
    const cfg = this.config;
    return Math.max(
      cfg.speedBonusMinMultiplier,
      cfg.speedBonusMaxMultiplier - elapsedSeconds * cfg.speedBonusDecayPerSecond,
    );
  }

  /** Get the total speed multiplier including speed streak bonus */
  getTotalSpeedMultiplier(elapsedSeconds: number, speedStreak: number): number {
    const base = this.getSpeedMultiplier(elapsedSeconds);
    const streakBonus = Math.min(
      speedStreak * this.config.speedStreakBonus,
      this.config.speedStreakCap,
    );
    return base + streakBonus;
  }

  /** Check if a placement time qualifies as "fast" */
  isFastPlacement(elapsedSeconds: number): boolean {
    return elapsedSeconds < this.config.speedStreakThreshold;
  }

  /** Calculate score for a single turn */
  calculate(
    clearResult: ClearResult,
    placedCellCount: number,
    streakCount: number,
    isBoardClear: boolean,
    elapsedSeconds: number,
    speedStreak: number,
  ): ScoreBreakdown {
    const cfg = this.config;

    // Base points: per-block destroyed + per-line cleared + placement bonus
    const blockPoints = clearResult.totalCellsRemoved * cfg.pointsPerBlockCleared;
    const linePoints = clearResult.totalLinesCleared * cfg.pointsPerLineCleared;
    const placementPoints = placedCellCount * cfg.placementPointsPerCell;
    const basePoints = blockPoints + linePoints + placementPoints;

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

    // Speed multiplier (base + speed streak bonus, only when lines are cleared)
    const speedMultiplier = clearResult.totalLinesCleared > 0
      ? this.getTotalSpeedMultiplier(elapsedSeconds, speedStreak)
      : 1.0;

    // Final score
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
}
