// src/services/bonusService.js
import { getDb } from '../db/database.js';

export const TASKS = {
  watch_ad:        { label: 'Посмотреть рекламу',  reward: 5,  repeatable: true  },
  invite_neighbor: { label: 'Пригласить соседа',   reward: 20, repeatable: false },
  rate_app:        { label: 'Оценить приложение',  reward: 10, repeatable: false },
  fill_profile:    { label: 'Заполнить профиль',   reward: 15, repeatable: false },
};

const LEVEL_XP = 100;

export async function addBonus(userId, amount, reason, meta = null) {
  const db = await getDb();

  const user = await db.get('SELECT bonus FROM users WHERE id = ?', userId);
  const newBonus = (user?.bonus ?? 0) + amount;
  const newLevel = Math.floor(newBonus / LEVEL_XP) + 1;

  await db.run(
    `UPDATE users SET bonus = bonus + ?, level = ?, streak = streak + 1 WHERE id = ?`,
    amount, newLevel, userId
  );
  await db.run(
    `INSERT INTO bonus_transactions (user_id, amount, reason, meta) VALUES (?, ?, ?, ?)`,
    userId, amount, reason, meta ? JSON.stringify(meta) : null
  );

  return db.get('SELECT * FROM users WHERE id = ?', userId);
}

export async function spendBonus(userId, amount, reason) {
  const db = await getDb();
  const user = await db.get('SELECT * FROM users WHERE id = ?', userId);
  if (!user) throw new Error('User not found');
  if (user.bonus < amount) throw new Error('Недостаточно бонусов');

  await db.run('UPDATE users SET bonus = bonus - ? WHERE id = ?', amount, userId);
  await db.run(
    `INSERT INTO bonus_transactions (user_id, amount, reason) VALUES (?, ?, ?)`,
    userId, -amount, reason
  );

  return db.get('SELECT * FROM users WHERE id = ?', userId);
}

export async function recordAdView(userId) {
  const db = await getDb();

  const lastView = await db.get(
    `SELECT viewed_at FROM ad_views WHERE user_id = ? ORDER BY viewed_at DESC LIMIT 1`,
    userId
  );

  if (lastView) {
    const secAgo = (Date.now() - new Date(lastView.viewed_at + 'Z').getTime()) / 1000;
    if (secAgo < 30) throw new Error(`Подождите ещё ${Math.ceil(30 - secAgo)} сек.`);
  }

  await db.run('INSERT INTO ad_views (user_id) VALUES (?)', userId);
  return addBonus(userId, 5, 'ad_watch');
}

export async function completeTask(userId, taskId) {
  const db = await getDb();
  const task = TASKS[taskId];
  if (!task) throw new Error('Unknown task: ' + taskId);

  if (!task.repeatable) {
    const done = await db.get(
      `SELECT id FROM task_completions WHERE user_id = ? AND task_id = ?`,
      userId, taskId
    );
    if (done) throw new Error('Задание уже выполнено');
  }

  await db.run(
    `INSERT OR IGNORE INTO task_completions (user_id, task_id, reward) VALUES (?, ?, ?)`,
    userId, taskId, task.reward
  );

  return addBonus(userId, task.reward, 'task', { taskId });
}

export async function processReferral(referrerId, referredId) {
  if (referrerId === referredId) throw new Error('Нельзя пригласить себя');
  const db = await getDb();

  const existing = await db.get('SELECT id FROM referrals WHERE referred_id = ?', referredId);
  if (existing) return null;

  await db.run(
    `INSERT INTO referrals (referrer_id, referred_id, bonus_paid) VALUES (?, ?, 20)`,
    referrerId, referredId
  );
  await addBonus(referrerId, 20, 'referral', { referredId });
  await addBonus(referredId, 10, 'referral_welcome', { referrerId });

  return { referrerBonus: 20, referredBonus: 10 };
}