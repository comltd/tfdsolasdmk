import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { getDb } from './db/database.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { requireAuth } from './middleware/auth.js';
import userRouter from './routes/user.js';
import bonusRouter from './routes/bonus.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Важно для Railway/Heroku — доверяем прокси
app.set('trust proxy', 1);

app.use(helmet());
app.use(globalLimiter);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed — ' + origin));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10kb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use('/api', requireAuth);
app.use('/api/user',  userRouter);
app.use('/api/bonus', bonusRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

getDb().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Backend: http://localhost:${PORT}`);
    console.log(`   BOT_TOKEN: ${process.env.BOT_TOKEN ? '✅ задан' : '❌ НЕ ЗАДАН'}`);
  });
}).catch(err => {
  console.error('❌ DB init failed:', err);
  process.exit(1);
});