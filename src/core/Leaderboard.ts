const STORAGE_KEY = 'freeblock_top10';
const NAME_KEY = 'freeblock_lastname';
const MAX_ENTRIES = 10;

export interface LeaderboardEntry {
  name: string;
  score: number;
  date: string;
}

export class Leaderboard {
  private entries: LeaderboardEntry[] = [];

  constructor() {
    this.load();
  }

  getEntries(): LeaderboardEntry[] {
    return this.entries;
  }

  getTopScore(): number {
    return this.entries.length > 0 ? this.entries[0].score : 0;
  }

  /** Get the last name the player used */
  getLastName(): string {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
  }

  /** Save the last name for next time */
  saveLastName(name: string): void {
    try { localStorage.setItem(NAME_KEY, name); } catch { /* */ }
  }

  /** Submit a score with a name. Returns the rank (1-based) if it made the top 10, or null. */
  submit(score: number, name: string): number | null {
    if (score <= 0) return null;

    const entry: LeaderboardEntry = {
      name: name.trim() || 'Player',
      score,
      date: new Date().toISOString(),
    };

    let rank = this.entries.findIndex(e => score > e.score);
    if (rank === -1) rank = this.entries.length;

    if (rank >= MAX_ENTRIES) return null;

    this.entries.splice(rank, 0, entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.length = MAX_ENTRIES;
    }

    this.save();
    this.saveLastName(entry.name);

    if (rank === 0) {
      try { localStorage.setItem('freeblock_highscore', String(score)); } catch { /* */ }
    }

    return rank + 1;
  }

  /** Check if a score would make the top 10 */
  wouldRank(score: number): boolean {
    if (score <= 0) return false;
    if (this.entries.length < MAX_ENTRIES) return true;
    return score > this.entries[this.entries.length - 1].score;
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.entries = JSON.parse(raw);
      } else {
        const legacy = localStorage.getItem('freeblock_highscore');
        if (legacy) {
          const score = parseInt(legacy, 10);
          if (score > 0) {
            this.entries = [{ name: 'Player', score, date: new Date().toISOString() }];
            this.save();
          }
        }
      }
    } catch {
      this.entries = [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch { /* */ }
  }
}
