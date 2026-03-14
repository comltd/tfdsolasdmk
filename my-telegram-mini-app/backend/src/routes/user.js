// src/routes/user.js
import { Router } from 'express';
import { getDb } from '../db/database.js';
import { TASKS } from '../services/bonusService.js';

const router = Router();

router.get('/me', async (req, res) => {
  const db = await getDb();
  const user = req.dbUser;

  const completedTasks = (await db.all(
    `SELECT task_id FROM task_completions WHERE user_id = ?`, user.id
  )).map(r => r.task_id);

  const history = await db.all(
    `SELECT amount, reason, meta, created_at FROM bonus_transactions
     WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`,
    user.id
  );

  res.json({
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username,
    bonus: user.bonus,
    level: user.level,
    streak: user.streak,
    last_active: user.last_active,
    created_at: user.created_at,
    completed_tasks: completedTasks,
    recent_history: history.map(h => ({ ...h, meta: h.meta ? JSON.parse(h.meta) : null })),
  });
});

router.get('/tasks', async (req, res) => {
  const db = await getDb();
  const completed = new Set(
    (await db.all('SELECT task_id FROM task_completions WHERE user_id = ?', req.dbUser.id))
      .map(r => r.task_id)
  );

  const tasks = Object.entries(TASKS).map(([id, task]) => ({
    id,
    label: task.label,
    reward: task.reward,
    repeatable: task.repeatable,
    done: !task.repeatable && completed.has(id),
  }));

  res.json({ tasks });
});

router.get('/leaderboard', async (req, res) => {
  const db = await getDb();

  const top = await db.all(
    `SELECT id, first_name, username, bonus, level FROM users ORDER BY bonus DESC LIMIT 10`
  );
  const myRank = await db.get(
    `SELECT COUNT(*) as rank FROM users WHERE bonus > (SELECT bonus FROM users WHERE id = ?)`,
    req.dbUser.id
  );

  res.json({
    leaderboard: top.map((u, i) => ({ rank: i + 1, ...u })),
    my_rank: (myRank?.rank ?? 0) + 1,
  });
});

export default router;