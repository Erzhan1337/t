import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TaskStatus } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { Server as HttpServer } from 'node:http';
import { AddressInfo } from 'node:net';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { z } from 'zod';
import { AppModule } from '../src/app.module';
import { RedisIoAdapter } from '../src/redis/redis-io.adapter';
import { RedisService } from '../src/redis/redis.service';
import { TaskStatusEvent } from '../src/tasks/types/task-status-event.type';
import { PrismaService } from '../src/prisma/prisma.service';

const authResponseSchema = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
  }),
});

const taskSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.nativeEnum(TaskStatus),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const taskStatusEventSchema = z.object({
  id: z.string().uuid(),
  status: z.nativeEnum(TaskStatus),
  timestamp: z.string().datetime(),
});

type AuthResponse = z.infer<typeof authResponseSchema>;

describe('Backend', () => {
  let app: INestApplication;
  let server: HttpServer;
  let prisma: PrismaService;
  let baseUrl: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    const redis = app.get(RedisService);
    const config = app.get(ConfigService);
    await redis.connect();
    app.useWebSocketAdapter(new RedisIoAdapter(app, redis, config));
    await app.listen(0);

    server = app.getHttpServer() as HttpServer;
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.task.deleteMany();
    await prisma.user.deleteMany();
  });

  afterEach(() => {
    while (sockets.length > 0) {
      sockets.pop()?.disconnect();
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers, logs in and never exposes the password hash', async () => {
    const agent = request.agent(server);
    const registration = await agent
      .post('/api/auth/register')
      .send({ email: 'USER@example.com', password: 'password123' })
      .expect(201);
    const registrationBody = authResponseSchema.parse(
      registration.body as unknown,
    );

    expect(registrationBody.accessToken).toEqual(expect.any(String));
    expect(registrationBody.user.email).toBe('user@example.com');
    expect(registrationBody.user).not.toHaveProperty('passwordHash');
    expect(registration.headers['set-cookie']).toBeDefined();
    const registrationCookies: unknown = registration.headers['set-cookie'];
    const [registrationCookie] = z.array(z.string()).parse(registrationCookies);
    const originalRefreshCookie = registrationCookie.split(';')[0];

    const refreshed = await agent.post('/api/auth/refresh').expect(200);
    const refreshedBody = authResponseSchema.parse(refreshed.body as unknown);
    expect(refreshedBody.accessToken).toEqual(expect.any(String));
    await request(server)
      .post('/api/auth/refresh')
      .set('Cookie', originalRefreshCookie)
      .expect(401);

    await agent
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${refreshedBody.accessToken}`)
      .expect(204);
    await agent.post('/api/auth/refresh').expect(401);

    const login = await request(server)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'password123' })
      .expect(200);
    const loginBody = authResponseSchema.parse(login.body as unknown);

    expect(loginBody.accessToken).toEqual(expect.any(String));
    expect(loginBody.user).not.toHaveProperty('passwordHash');

    await request(server)
      .post('/api/auth/register')
      .send({ email: 'user@example.com', password: 'password123' })
      .expect(409);
    await request(server)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'wrong-password' })
      .expect(401);
  });

  it('protects task routes and validates an empty title', async () => {
    const unauthorized = await request(server).get('/api/tasks').expect(401);
    expect(unauthorized.headers['x-request-id']).toEqual(expect.any(String));
    expect(unauthorized.body).toMatchObject({
      statusCode: 401,
      requestId: unauthorized.headers['x-request-id'],
    });
    const auth = await register('validation@example.com');

    await request(server)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ title: '   ' })
      .expect(400);
    await request(server)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ title: 'Valid', unexpected: true })
      .expect(400);

    await expectSocketConnectionToFail('invalid-token');
  });

  it('isolates task CRUD by user', async () => {
    const first = await register('first@example.com');
    const second = await register('second@example.com');
    const created = await request(server)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send({ title: 'First task', description: 'Description' })
      .expect(201);
    const task = taskSchema.parse(created.body as unknown);
    expect(task).toMatchObject({
      title: 'First task',
      description: 'Description',
      status: TaskStatus.TODO,
    });

    const firstTasks = await request(server)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .expect(200);
    expect(z.array(taskSchema).parse(firstTasks.body as unknown)).toHaveLength(
      1,
    );

    await request(server)
      .patch(`/api/tasks/${task.id}`)
      .set('Authorization', `Bearer ${second.accessToken}`)
      .send({ status: TaskStatus.DONE })
      .expect(404);

    await request(server)
      .delete(`/api/tasks/${task.id}`)
      .set('Authorization', `Bearer ${second.accessToken}`)
      .expect(404);

    await request(server)
      .patch(`/api/tasks/${task.id}`)
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send({})
      .expect(400);

    await request(server)
      .patch(`/api/tasks/${task.id}`)
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send({ status: 'UNKNOWN' })
      .expect(400);

    const updated = await request(server)
      .patch(`/api/tasks/${task.id}`)
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send({ title: 'Updated task', description: null })
      .expect(200);
    expect(taskSchema.parse(updated.body as unknown)).toMatchObject({
      id: task.id,
      title: 'Updated task',
      description: null,
    });

    const secondTasks = await request(server)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${second.accessToken}`)
      .expect(200);

    expect(secondTasks.body).toEqual([]);

    await request(server)
      .delete(`/api/tasks/${task.id}`)
      .set('Authorization', `Bearer ${first.accessToken}`)
      .expect(204);

    const remainingTasks = await request(server)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .expect(200);
    expect(remainingTasks.body).toEqual([]);
  });

  it('delivers status changes to two connections of the owner only', async () => {
    const owner = await register('owner@example.com');
    const anotherUser = await register('another@example.com');
    const created = await request(server)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Realtime task' })
      .expect(201);
    const task = created.body as unknown as { id: string };

    const firstSocket = await connectSocket(owner.accessToken);
    const secondSocket = await connectSocket(owner.accessToken);
    const anotherSocket = await connectSocket(anotherUser.accessToken);
    let anotherUserReceivedEvent = false;
    anotherSocket.on('task.status.changed', () => {
      anotherUserReceivedEvent = true;
    });

    const firstEvent = waitForStatusEvent(firstSocket);
    const secondEvent = waitForStatusEvent(secondSocket);

    await request(server)
      .patch(`/api/tasks/${task.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ status: TaskStatus.IN_PROGRESS })
      .expect(200);

    const [firstPayload, secondPayload] = await Promise.all([
      firstEvent,
      secondEvent,
    ]);

    expect(taskStatusEventSchema.parse(firstPayload)).toMatchObject({
      id: task.id,
      status: TaskStatus.IN_PROGRESS,
    });
    expect(secondPayload).toEqual(firstPayload);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(anotherUserReceivedEvent).toBe(false);
  });

  async function register(email: string): Promise<AuthResponse> {
    const response = await request(server)
      .post('/api/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    return authResponseSchema.parse(response.body as unknown);
  }

  async function connectSocket(accessToken: string): Promise<Socket> {
    const socket = io(baseUrl, {
      transports: ['websocket'],
      auth: { token: accessToken },
      forceNew: true,
    });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    return socket;
  }

  async function expectSocketConnectionToFail(
    accessToken: string,
  ): Promise<void> {
    const socket = io(baseUrl, {
      transports: ['websocket'],
      auth: { token: accessToken },
      forceNew: true,
      reconnection: false,
    });
    sockets.push(socket);
    await expect(
      new Promise<void>((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('connect_error', reject);
      }),
    ).rejects.toThrow('Unauthorized');
  }

  function waitForStatusEvent(socket: Socket): Promise<TaskStatusEvent> {
    return new Promise((resolve) => {
      socket.once('task.status.changed', (payload: TaskStatusEvent) => {
        resolve(payload);
      });
    });
  }
});
