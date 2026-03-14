// src/routes/bonus.js
import { Router } from 'express';
import { adLimiter, taskLimiter } from '../middleware/rateLimiter.js';
import { recordAdView, completeTask, spendBonus, processReferral } from '../services/bonusService.js';

const router = Router();

router.post('/ad', adLimiter, async (req, res) => {
  try {
    const user = await recordAdView(req.dbUser.id);
    res.json({ success: true, reward: 5, new_balance: user.bonus, level: user.level });
  } catch (err) {
    res.status(429).json({ error: err.message });
  }
});

router.post('/task', taskLimiter, async (req, res) => {
  const { task_id } = req.body;
  if (!task_id) return res.status(400).json({ error: 'task_id is required' });
  try {
    const user = await completeTask(req.dbUser.id, task_id);
    res.json({ success: true, task_id, new_balance: user.bonus, level: user.level });
  } catch (err) {
    const status = err.message.includes('уже выполнено') ? 409 : 400;
    res.status(status).json({ error: err.message });
  }
});

router.post('/spend', async (req, res) => {
  const { amount, reason } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
  if (!reason) return res.status(400).json({ error: 'reason is required' });
  try {
    const user = await spendBonus(req.dbUser.id, amount, reason);
    res.json({ success: true, spent: amount, new_balance: user.bonus });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/referral', async (req, res) => {
  const { referrer_id } = req.body;
  if (!referrer_id) return res.status(400).json({ error: 'referrer_id is required' });
  try {
    const result = await processReferral(Number(referrer_id), req.dbUser.id);
    if (!result) return res.json({ success: false, message: 'Реферал уже был учтён' });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;