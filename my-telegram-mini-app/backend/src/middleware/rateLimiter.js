// src/middleware/rateLimiter.js
// Разные лимиты для разных эндпоинтов.

import rateLimit from 'express-rate-limit';

// Общий лимит — 120 запросов в минуту на IP
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down' },
});

// Просмотр рекламы — не чаще 1 раза в 30 секунд на пользователя
// (дополнительная проверка по user_id делается в роуте через БД)
export const adLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 1,
  keyGenerator: (req) => String(req.dbUser?.id ?? req.ip),
  message: { error: 'Подождите 30 секунд между просмотрами рекламы' },
  skipFailedRequests: false,
});

// Выполнение заданий — не чаще 5 в минуту
export const taskLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => String(req.dbUser?.id ?? req.ip),
  message: { error: 'Слишком много запросов к заданиям' },
});