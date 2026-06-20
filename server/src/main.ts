import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { RedisService } from './redis/redis.service';
import { RedisIoAdapter } from './redis/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const redis = app.get(RedisService);

  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: config.getOrThrow<string>('CLIENT_ORIGIN'),
    credentials: true,
  });
  app.enableShutdownHooks();

  await redis.connect();
  app.useWebSocketAdapter(new RedisIoAdapter(app, redis, config));
  await app.listen(config.getOrThrow<number>('PORT'));
}

const logger = new Logger('Bootstrap');
void bootstrap().catch((error: unknown) => {
  logger.error(error);
  process.exit(1);
});
