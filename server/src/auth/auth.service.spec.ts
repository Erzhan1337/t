import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const user = {
    id: 'c43cc5af-b31d-42d4-9082-c80464ad5a0f',
    email: 'user@example.com',
    createdAt: new Date('2026-06-20T00:00:00.000Z'),
    updatedAt: new Date('2026-06-20T00:00:00.000Z'),
  };
  const usersService = {
    create: jest.fn(),
    findByEmailForAuthentication: jest.fn(),
    findById: jest.fn(),
  };
  const redisService = {
    setRefreshSession: jest.fn(),
    consumeRefreshSession: jest.fn(),
    deleteRefreshSession: jest.fn(),
  };
  const values: Record<string, string | number> = {
    JWT_ACCESS_SECRET: 'access-secret-with-at-least-32-characters',
    JWT_REFRESH_SECRET: 'refresh-secret-with-at-least-32-characters',
    JWT_ACCESS_TTL_SECONDS: 900,
    JWT_REFRESH_TTL_SECONDS: 604800,
    BCRYPT_ROUNDS: 10,
  };
  const configService = {
    getOrThrow: jest.fn((key: string) => values[key]),
  };
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    redisService.setRefreshSession.mockResolvedValue(undefined);
    service = new AuthService(
      usersService as unknown as UsersService,
      new JwtService(),
      redisService as unknown as RedisService,
      configService as unknown as ConfigService,
    );
  });

  it('registers a user and returns tokens without a password hash', async () => {
    usersService.create.mockResolvedValue(user);

    const result = await service.register({
      email: user.email,
      password: 'password123',
    });

    expect(usersService.create).toHaveBeenCalledWith(
      user.email,
      expect.not.stringMatching('password123'),
    );
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.user).toEqual(user);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(redisService.setRefreshSession).toHaveBeenCalledTimes(1);
  });

  it('logs in with valid credentials', async () => {
    const passwordHash = await bcrypt.hash('password123', 4);
    usersService.findByEmailForAuthentication.mockResolvedValue({
      ...user,
      passwordHash,
    });

    const result = await service.login({
      email: user.email,
      password: 'password123',
    });

    expect(result.user).toEqual(user);
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('rejects invalid credentials', async () => {
    usersService.findByEmailForAuthentication.mockResolvedValue(null);

    await expect(
      service.login({ email: user.email, password: 'password123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
