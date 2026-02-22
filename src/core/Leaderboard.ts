import {
  collection, query, where, orderBy, limit,
  getDocs, getDoc, setDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db, ensureAuth } from '../firebase';

const STORAGE_KEY = 'freeblock_top10';
const NAME_KEY = 'freeblock_lastname';
const MAX_ENTRIES = 10;
const MODE = 'freeblock';

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

  /** Submit a score to Firestore. Falls back to local-only on failure. */
  async submit(score: number, name: string): Promise<number | null> {
    if (score <= 0) return null;
    const cleanName = name.trim() || 'Player';
    this.saveLastName(cleanName);

    try {
      const user = await ensureAuth();
      const docId = `${user.uid}_${MODE}`;
      const ref = doc(db, 'leaderboard', docId);

      // Only write if this score is higher than the existing one
      const existing = await getDoc(ref);
      if (existing.exists() && existing.data().score >= score) {
        // Existing score is equal or higher — just refresh and return rank
        await this.fetchRemote();
        const rank = this.entries.findIndex(e => e.score <= score);
        return rank >= 0 && rank < MAX_ENTRIES ? rank + 1 : null;
      }

      await setDoc(ref, {
        uid: user.uid,
        displayName: cleanName,
        score,
        mode: MODE,
        date: new Date().toISOString().split('T')[0],
        timestamp: serverTimestamp(),
      });

      // Refresh from Firestore
      await this.fetchRemote();

      // Determine rank
      const rank = this.entries.findIndex(e => e.score <= score);
      return rank >= 0 && rank < MAX_ENTRIES ? rank + 1 : null;
    } catch {
      // Offline fallback
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
      const q = query(
        collection(db, 'leaderboard'),
        where('mode', '==', MODE),
        orderBy('score', 'desc'),
        limit(MAX_ENTRIES),
      );
      const snapshot = await getDocs(q);
      this.entries = snapshot.docs.map(d => {
        const data = d.data();
        return {
          name: data.displayName || 'Player',
          score: data.score,
          date: data.date || '',
        };
      });
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
