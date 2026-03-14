// src/bot.js
// Простой long-polling бот — отвечает на /start и отправляет кнопку Mini App

import 'dotenv/config';

const TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.FRONTEND_URL; // URL вашего Netlify

if (!TOKEN) { console.error('❌ BOT_TOKEN не задан в .env'); process.exit(1); }

const API = `https://api.telegram.org/bot${TOKEN}`;

// ── Отправка запросов к Telegram API ─────────────────────────────
async function call(method, params = {}) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.ok) console.error(`[bot] ${method} failed:`, data.description);
  return data;
}

// ── Обработка входящих сообщений ─────────────────────────────────
async function handleUpdate(update) {
  const msg = update.message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const text   = msg.text ?? '';
  const name   = msg.from?.first_name ?? 'Сосед';

  if (text === '/start' || text.startsWith('/start ')) {
    // Извлекаем реферальный параметр если есть: /start ref_123456
    const parts = text.split(' ');
    const refParam = parts[1]; // например "ref_123456789"

    if (refParam?.startsWith('ref_')) {
      const referrerId = parseInt(refParam.replace('ref_', ''), 10);
      // Отправим реферальный ID в Mini App через startapp параметр
      console.log(`[bot] Реферал от ${referrerId} для ${msg.from.id}`);
    }

    await call('sendMessage', {
      chat_id: chatId,
      text: `👋 Привет, ${name}!\n\n🏠 Добро пожаловать в сервис *ОСИ Костанай*\n\nЗдесь вы можете:\n• 🎁 Зарабатывать бонусы\n• 💳 Оплачивать взносы ОСИ\n• 👥 Приглашать соседей\n\nНажмите кнопку ниже чтобы открыть приложение 👇`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🏠 Открыть приложение',
            web_app: { url: APP_URL }
          }
        ]]
      }
    });
    return;
  }

  if (text === '/help') {
    await call('sendMessage', {
      chat_id: chatId,
      text: `ℹ️ *Команды бота:*\n\n/start — открыть приложение\n/balance — проверить баланс\n/help — помощь`,
      parse_mode: 'Markdown',
    });
    return;
  }

  if (text === '/balance') {
    await call('sendMessage', {
      chat_id: chatId,
      text: `💰 Ваш баланс доступен в приложении.\n\nНажмите /start чтобы открыть его.`,
    });
    return;
  }

  // Любое другое сообщение
  await call('sendMessage', {
    chat_id: chatId,
    text: `Используйте /start чтобы открыть приложение 🏠`,
    reply_markup: {
      inline_keyboard: [[
        { text: '🏠 Открыть', web_app: { url: APP_URL } }
      ]]
    }
  });
}

// ── Long polling ─────────────────────────────────────────────────
let offset = 0;

async function poll() {
  try {
    const data = await call('getUpdates', {
      offset,
      timeout: 30,
      allowed_updates: ['message'],
    });

    if (data.ok && data.result.length > 0) {
      for (const update of data.result) {
        offset = update.update_id + 1;
        await handleUpdate(update).catch(err =>
          console.error('[bot] handleUpdate error:', err)
        );
      }
    }
  } catch (err) {
    console.error('[bot] poll error:', err.message);
    await new Promise(r => setTimeout(r, 5000)); // пауза при ошибке
  }

  // Следующий цикл
  setImmediate(poll);
}

// ── Установка команд в меню бота ─────────────────────────────────
async function setCommands() {
  await call('setMyCommands', {
    commands: [
      { command: 'start', description: '🏠 Открыть приложение' },
      { command: 'balance', description: '💰 Проверить баланс' },
      { command: 'help', description: 'ℹ️ Помощь' },
    ]
  });
  console.log('✅ Команды бота установлены');
}

// ── Запуск ───────────────────────────────────────────────────────
console.log('🤖 Бот запущен, жду сообщения...');
setCommands();
poll();