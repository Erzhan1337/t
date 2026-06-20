import { getTestDatabaseUrl } from './test-database-url';

process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.DATABASE_URL = getTestDatabaseUrl();
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379';
process.env.CLIENT_ORIGIN = 'http://localhost:3000';
process.env.JWT_ACCESS_SECRET =
  'test-access-secret-with-at-least-32-characters';
process.env.JWT_REFRESH_SECRET =
  'test-refresh-secret-with-at-least-32-characters';
process.env.JWT_ACCESS_TTL_SECONDS = '900';
process.env.JWT_REFRESH_TTL_SECONDS = '604800';
process.env.COOKIE_NAME = 'refresh_token';
process.env.COOKIE_SECURE = 'false';
process.env.BCRYPT_ROUNDS = '10';
