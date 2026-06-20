# OpKit Frontend

Минимальный интерфейс для backend мини-CRM из тестового задания.

## Возможности

- регистрация и вход;
- восстановление сессии через refresh-cookie;
- выход из аккаунта;
- создание, редактирование и удаление задач;
- канбан из статусов `TODO`, `IN_PROGRESS`, `DONE`;
- автоматическое обновление статуса через Socket.IO.

## Запуск

Скопировать настройки окружения:

```bash
cp .env.example .env.local
```

Установить зависимости и запустить приложение:

```bash
bun install
bun run dev
```

Frontend будет доступен по адресу `http://localhost:3000`. Backend по умолчанию ожидается на `http://localhost:4000`.

Для production-сборки:

```bash
bun run typecheck
bun run build
```
