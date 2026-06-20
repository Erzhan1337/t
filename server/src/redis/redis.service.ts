import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { REFRESH_SESSION_PREFIX } from './redis.constants';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: RedisClientType;
  private readonly publisher: RedisClientType;
  private readonly subscriber: RedisClientType;

  constructor(configService: ConfigService) {
    const url = configService.getOrThrow<string>('REDIS_URL');
    this.client = createClient({ url });
    this.publisher = this.client.duplicate();
    this.subscriber = this.client.duplicate();
    this.registerErrorHandler(this.client, 'client');
    this.registerErrorHandler(this.publisher, 'publisher');
    this.registerErrorHandler(this.subscriber, 'subscriber');
  }

  async connect(): Promise<void> {
    await Promise.all([
      this.connectClient(this.client),
      this.connectClient(this.publisher),
      this.connectClient(this.subscriber),
    ]);
  }

  getPublisher(): RedisClientType {
    return this.publisher;
  }

  getSubscriber(): RedisClientType {
    return this.subscriber;
  }

  async setRefreshSession(
    sessionId: string,
    userId: string,
    ttlSeconds: number,
  ): Promise<void> {
    this.assertConnected();
    await this.client.set(this.sessionKey(sessionId), userId, {
      expiration: { type: 'EX', value: ttlSeconds },
    });
  }

  async consumeRefreshSession(sessionId: string): Promise<string | null> {
    this.assertConnected();
    return this.client.getDel(this.sessionKey(sessionId));
  }

  async deleteRefreshSession(sessionId: string): Promise<void> {
    this.assertConnected();
    await this.client.del(this.sessionKey(sessionId));
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([
      this.closeClient(this.client),
      this.closeClient(this.publisher),
      this.closeClient(this.subscriber),
    ]);
  }

  private async connectClient(client: RedisClientType): Promise<void> {
    if (!client.isOpen) {
      await client.connect();
    }
  }

  private async closeClient(client: RedisClientType): Promise<void> {
    if (client.isOpen) {
      await client.quit();
    }
  }

  private assertConnected(): void {
    if (!this.client.isReady) {
      throw new ServiceUnavailableException('Redis is unavailable');
    }
  }

  private sessionKey(sessionId: string): string {
    return `${REFRESH_SESSION_PREFIX}${sessionId}`;
  }

  private registerErrorHandler(
    client: RedisClientType,
    clientName: string,
  ): void {
    client.on('error', (error: Error) => {
      this.logger.error(`Redis ${clientName}: ${error.message}`, error.stack);
    });
  }
}
