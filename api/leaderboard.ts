import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const KEY = 'freeblock:top10';
const MAX = 10;

interface Entry {
  name: string;
  score: number;
  date: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    if (req.method === 'GET') {
      const entries: Entry[] = (await redis.get(KEY)) || [];
      return res.status(200).json(entries);
    }

    if (req.method === 'POST') {
      const { name, score } = req.body;
      if (!name || typeof score !== 'number' || score <= 0) {
        return res.status(400).json({ error: 'Invalid input' });
      }

      const entry: Entry = {
        name: String(name).trim().slice(0, 12) || 'Player',
        score,
        date: new Date().toISOString(),
      };

      const entries: Entry[] = (await redis.get(KEY)) || [];

      // Find insertion point (descending by score)
      let rank = entries.findIndex(e => score > e.score);
      if (rank === -1) rank = entries.length;

      if (rank >= MAX) {
        return res.status(200).json({ rank: null });
      }

      entries.splice(rank, 0, entry);
      if (entries.length > MAX) entries.length = MAX;

      await redis.set(KEY, entries);

      return res.status(200).json({ rank: rank + 1 });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
