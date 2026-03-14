#!/bin/bash
# setup.sh — запустите один раз: bash setup.sh
# Создаёт структуру папок и устанавливает зависимости

set -e

echo "📁 Создаю структуру папок..."
mkdir -p src/db src/middleware src/routes src/services data

echo "📦 Устанавливаю зависимости..."
npm install

echo "⚙️  Создаю .env из шаблона..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ Файл .env создан — откройте его и вставьте BOT_TOKEN"
else
  echo "⚠️  .env уже существует, пропускаю"
fi

echo ""
echo "✅ Готово! Следующий шаг:"
echo "   1. Откройте .env и вставьте BOT_TOKEN от @BotFather"
echo "   2. Запустите: npm run dev"