// src/db/database.js
// Используем 'sqlite' + 'sqlite3' — работает на любой версии Node.js
// без компиляции C++ кода.

import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../data/app.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let _db = null;

export async function getDb() {
  if (_db) return _db;

  _db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });

  await _db.exec('PRAGMA journal_mode = WAL');
  await _db.exec('PRAGMA foreign_keys = ON');

  await _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY,
      first_name    TEXT    NOT NULL,
      last_name     TEXT,
      username      TEXT,
      bonus         INTEGER NOT NULL DEFAULT 0,
      level         INTEGER NOT NULL DEFAULT 1,
      streak        INTEGER NOT NULL DEFAULT 0,
      last_active   TEXT    NOT NULL DEFAULT (datetime('now')),
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bonus_transactions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      amount     INTEGER NOT NULL,
      reason     TEXT    NOT NULL,
      meta       TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_completions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id),
      task_id      TEXT    NOT NULL,
      reward       INTEGER NOT NULL,
      completed_at TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, task_id)
    );

    CREATE TABLE IF NOT EXISTS ad_views (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   INTEGER NOT NULL REFERENCES users(id),
      reward    INTEGER NOT NULL DEFAULT 5,
      viewed_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id  INTEGER NOT NULL REFERENCES users(id),
      referred_id  INTEGER NOT NULL REFERENCES users(id) UNIQUE,
      bonus_paid   INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tx_user   ON bonus_transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_ad_user   ON ad_views(user_id, viewed_at);
    CREATE INDEX IF NOT EXISTS idx_task_user ON task_completions(user_id);
  `);

  console.log('✅ Database ready:', DB_PATH);
  return _db;
}