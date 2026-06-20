# OpKit Backend

Backend мини-CRM для управления пользовательскими задачами с JWT-аутентификацией и real-time обновлением статусов.

## Стек

- NestJS
- TypeScript
- PostgreSQL
- Prisma ORM
- Redis
- JWT
- Socket.IO
- Jest
- Docker Compose

## Возможности

- регистрация и вход пользователя;
- JWT access token;
- ротация refresh token через Redis;
- глобальная защита HTTP-маршрутов;
- CRUD задач с проверкой владельца;
- статусы `TODO`, `IN_PROGRESS`, `DONE`;
- WebSocket-события при изменении статуса;
- доставка событий всем соединениям владельца задачи;
- Redis adapter для нескольких экземпляров API;
- валидация входных данных;
- unit и E2E-тесты.

## Требования

- Node.js 20 или новее
- Yarn 1.x
- Docker с Docker Compose

## Локальный запуск

Установить зависимости:

```bash
yarn install
```

Скопировать файл `.env.example` в новый файл `.env`:

```bash
cp .env.example .env
```

Запустить PostgreSQL и Redis:

```bash
docker compose up -d
```

Сгенерировать Prisma Client и применить миграции:

```bash
yarn prisma:generate
yarn prisma:deploy
```

Запустить API:

```bash
yarn start:dev
```

API будет доступен по адресу `http://localhost:4000/api`.

## HTTP API

### Аутентификация

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
```

`register` и `login` принимают:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Ответ содержит access token:

```json
{
  "accessToken": "jwt-token",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "createdAt": "2026-06-20T00:00:00.000Z",
    "updatedAt": "2026-06-20T00:00:00.000Z"
  }
}
```

Refresh token устанавливается в HttpOnly cookie. Закрытые маршруты принимают access token через `Authorization: Bearer <token>`.

### Задачи

```text
GET /api/tasks
POST /api/tasks
PATCH /api/tasks/:id
DELETE /api/tasks/:id
```

Создание задачи:

```json
{
  "title": "Подготовить отчёт",
  "description": "Собрать результаты за неделю"
}
```

Обновление задачи:

```json
{
  "status": "IN_PROGRESS"
}
```

## WebSocket

JWT передаётся при подключении:

```ts
io('http://localhost:4000', {
  auth: {
    token: accessToken,
  },
});
```

При изменении статуса сервер отправляет событие `task.status.changed`:

```json
{
  "id": "task-id",
  "status": "IN_PROGRESS",
  "timestamp": "2026-06-20T12:00:00.000Z"
}
```

Событие получают все активные соединения владельца задачи. Соединения других пользователей событие не получают.

## Проверки

```bash
yarn lint
yarn typecheck
yarn format:check
yarn test
yarn test:e2e
yarn build
yarn prisma:validate
docker compose config
```

E2E-тесты используют `TEST_DATABASE_URL` и `TEST_REDIS_URL`, если они заданы. По умолчанию используются сервисы из `docker-compose.yaml`. Миграции применяются автоматически в изолированную PostgreSQL-схему `opkit_test`; данные development-схемы тестами не удаляются.

## Структура

```text
src/auth       JWT-аутентификация и глобальная авторизация
src/users      работа с пользователями
src/tasks      CRUD задач и WebSocket Gateway
src/prisma     подключение Prisma
src/redis      Redis и Socket.IO adapter
src/config     проверка окружения
src/common     общие фильтры и interceptors
prisma         схема и миграции
test           E2E-тесты
```

## Frontend

Технологии: Next.js, React, TypeScript, Socket.IO Client и Tailwind CSS.

Запуск:

```bash
cd client
cp .env.example .env.local
bun install
bun run dev
```

Frontend будет доступен по адресу `http://localhost:3000`. Backend должен быть запущен на `http://localhost:4000`.
