import { Redis } from '@upstash/redis';

export const config = { runtime: 'edge' };

const KV_KEY = 'leaderboard:freeblock';
const MAX_ENTRIES = 10;

interface Entry {
  id: string;
  name: string;
  score: number;
  date: string;
}

function getRedis(): Redis {
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
}

async function getEntries(): Promise<Entry[]> {
  const redis = getRedis();
  return (await redis.get<Entry[]>(KV_KEY)) || [];
}

async function saveEntries(entries: Entry[]): Promise<void> {
  const redis = getRedis();
  await redis.set(KV_KEY, entries);
}

export default async function handler(request: Request): Promise<Response> {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  if (request.method === 'GET') {
    const entries = await getEntries();
    return new Response(JSON.stringify(entries), { headers });
  }

  if (request.method === 'POST') {
    let body: { id?: string; name?: string; score?: number };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
    }

    const { id, name, score } = body;
    if (!id || !name || typeof score !== 'number' || score <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid data' }), { status: 400, headers });
    }

    const entries = await getEntries();

    // If this player already has an entry, only update if new score is higher
    const existingIdx = entries.findIndex(e => e.id === id);
    if (existingIdx >= 0) {
      if (entries[existingIdx].score >= score) {
        const rank = entries.findIndex(e => e.score <= score);
        return new Response(JSON.stringify({ rank: rank >= 0 ? rank + 1 : null, entries }), { headers });
      }
      entries.splice(existingIdx, 1);
    }

    const entry: Entry = {
      id,
      name: name.trim().slice(0, 12) || 'Player',
      score,
      date: new Date().toISOString().split('T')[0],
    };

    // Insert in sorted position (descending by score)
    let rank = entries.findIndex(e => score > e.score);
    if (rank === -1) rank = entries.length;
    entries.splice(rank, 0, entry);

    // Keep top N only
    if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;

    await saveEntries(entries);

    const finalRank = rank < MAX_ENTRIES ? rank + 1 : null;
    return new Response(JSON.stringify({ rank: finalRank, entries }), { headers });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
}
