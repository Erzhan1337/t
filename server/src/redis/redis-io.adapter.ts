import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server, ServerOptions } from 'socket.io';
import { RedisService } from './redis.service';

export class RedisIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: this.configService.getOrThrow<string>('CLIENT_ORIGIN'),
        credentials: true,
      },
    }) as Server;

    server.adapter(
      createAdapter(
        this.redisService.getPublisher(),
        this.redisService.getSubscriber(),
      ),
    );

    return server;
  }
}
