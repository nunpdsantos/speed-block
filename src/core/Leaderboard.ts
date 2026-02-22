const STORAGE_KEY = 'speedblock_top10';
const NAME_KEY = 'speedblock_lastname';
const PLAYER_ID_KEY = 'speedblock_playerid';
const MAX_ENTRIES = 10;
const API_URL = '/api/leaderboard';

export interface LeaderboardEntry {
  name: string;
  score: number;
  date: string;
}

export class Leaderboard {
  private entries: LeaderboardEntry[] = [];
  private fetchPromise: Promise<void> | null = null;

  constructor() {
    this.loadLocal();
    this.fetchPromise = this.fetchRemote();
  }

  getEntries(): LeaderboardEntry[] {
    return this.entries;
  }

  async waitForRemote(): Promise<void> {
    if (this.fetchPromise) await this.fetchPromise;
  }

  getTopScore(): number {
    return this.entries.length > 0 ? this.entries[0].score : 0;
  }

  getLastName(): string {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
  }

  saveLastName(name: string): void {
    try { localStorage.setItem(NAME_KEY, name); } catch { /* */ }
  }

  private getPlayerId(): string {
    try {
      let id = localStorage.getItem(PLAYER_ID_KEY);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(PLAYER_ID_KEY, id);
      }
      return id;
    } catch {
      return crypto.randomUUID();
    }
  }

  /** Submit a score. Falls back to local-only on failure. */
  async submit(score: number, name: string): Promise<number | null> {
    if (score <= 0) return null;
    const cleanName = name.trim() || 'Player';
    this.saveLastName(cleanName);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: this.getPlayerId(),
          name: cleanName,
          score,
        }),
      });

      if (!res.ok) throw new Error('API error');

      const data = await res.json();
      if (data.entries) {
        this.entries = data.entries.map((e: Record<string, unknown>) => ({
          name: (e.name as string) || 'Player',
          score: e.score as number,
          date: (e.date as string) || '',
        }));
        this.saveLocal();
      }
      return data.rank || null;
    } catch {
      return this.submitLocal(score, cleanName);
    }
  }

  wouldRank(score: number): boolean {
    if (score <= 0) return false;
    if (this.entries.length < MAX_ENTRIES) return true;
    return score > this.entries[this.entries.length - 1].score;
  }

  private async fetchRemote(): Promise<void> {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      this.entries = data.map((e: Record<string, unknown>) => ({
        name: (e.name as string) || 'Player',
        score: e.score as number,
        date: (e.date as string) || '',
      }));
      this.saveLocal();
    } catch {
      // Offline — keep local data
    }
    this.fetchPromise = null;
  }

  private submitLocal(score: number, name: string): number | null {
    const entry: LeaderboardEntry = { name, score, date: new Date().toISOString() };

    let rank = this.entries.findIndex(e => score > e.score);
    if (rank === -1) rank = this.entries.length;
    if (rank >= MAX_ENTRIES) return null;

    this.entries.splice(rank, 0, entry);
    if (this.entries.length > MAX_ENTRIES) this.entries.length = MAX_ENTRIES;
    this.saveLocal();
    return rank + 1;
  }

  private loadLocal(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.entries = JSON.parse(raw);
      }
    } catch {
      this.entries = [];
    }
  }

  private saveLocal(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch { /* */ }
  }
}
