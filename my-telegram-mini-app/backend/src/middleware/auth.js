// src/middleware/auth.js
import crypto from 'crypto';
import { getDb } from '../db/database.js';

const BOT_TOKEN = process.env.BOT_TOKEN;
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

export function verifyInitData(initDataRaw) {
  if (!initDataRaw) return { valid: false, error: 'No initData' };
  if (!BOT_TOKEN)   return { valid: false, error: 'BOT_TOKEN not set' };

  const cached = cache.get(initDataRaw);
  if (cached && cached.exp > Date.now()) return { valid: true, user: cached.user };

  try {
    const params = new URLSearchParams(initDataRaw);
    const hash = params.get('hash');
    if (!hash) return { valid: false, error: 'No hash' };

    const authDate = parseInt(params.get('auth_date') ?? '0', 10);
    if (Math.floor(Date.now() / 1000) - authDate > 3600)
      return { valid: false, error: 'initData expired' };

    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (expectedHash !== hash) return { valid: false, error: 'Invalid hash' };

    const user = JSON.parse(params.get('user') ?? 'null');
    if (!user) return { valid: false, error: 'No user' };

    cache.set(initDataRaw, { user, exp: Date.now() + CACHE_TTL_MS });
    return { valid: true, user };
  } catch (err) {
    return { valid: false, error: 'Parse error: ' + err.message };
  }
}

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization ?? '';
    const initDataRaw = authHeader.startsWith('tma ') ? authHeader.slice(4) : null;

    console.log('[auth] NODE_ENV:', process.env.NODE_ENV);
    console.log('[auth] initDataRaw:', initDataRaw);

    // Dev bypass
    if (process.env.NODE_ENV === 'development' && initDataRaw === 'dev_bypass') {
      console.log('[auth] dev_bypass accepted');
      const tgUser = { id: 1, first_name: 'Dev', last_name: 'User', username: 'devuser' };
      req.tgUser = tgUser;
      req.dbUser = await upsertUser(tgUser);
      console.log('[auth] dbUser:', req.dbUser);
      return next();
    }

    const result = verifyInitData(initDataRaw);
    if (!result.valid) {
      return res.status(401).json({ error: 'Unauthorized', detail: result.error });
    }

    req.tgUser = result.user;
    req.dbUser = await upsertUser(result.user);
    next();
  } catch (err) {
    console.error('[auth] ERROR:', err);
    res.status(500).json({ error: 'Auth error: ' + err.message });
  }
}

async function upsertUser(tgUser) {
  console.log('[upsertUser] start for id:', tgUser.id);
  const db = await getDb();
  console.log('[upsertUser] got db');

  const existing = await db.get('SELECT * FROM users WHERE id = ?', tgUser.id);
  console.log('[upsertUser] existing:', existing);

  if (!existing) {
    await db.run(
      `INSERT INTO users (id, first_name, last_name, username) VALUES (?, ?, ?, ?)`,
      tgUser.id, tgUser.first_name, tgUser.last_name ?? null, tgUser.username ?? null
    );
  } else {
    await db.run(
      `UPDATE users SET first_name=?, last_name=?, username=?, last_active=datetime('now') WHERE id=?`,
      tgUser.first_name, tgUser.last_name ?? null, tgUser.username ?? null, tgUser.id
    );
  }

  const user = await db.get('SELECT * FROM users WHERE id = ?', tgUser.id);
  console.log('[upsertUser] done:', user);
  return user;
}