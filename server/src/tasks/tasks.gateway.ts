import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { UsersService } from '../users/users.service';
import { TaskStatusEvent } from './types/task-status-event.type';

@WebSocketGateway()
export class TasksGateway implements OnGatewayInit {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly accessSecret: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    configService: ConfigService,
  ) {
    this.accessSecret = configService.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  afterInit(server: Server): void {
    server.use((client, next) => {
      void this.authorize(client).then(
        () => next(),
        () => next(new Error('Unauthorized')),
      );
    });
  }

  emitStatusChanged(userId: string, event: TaskStatusEvent): void {
    this.server.to(this.userRoom(userId)).emit('task.status.changed', event);
  }

  private async authorize(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.accessSecret,
    });

    if (payload.type !== 'access' || !payload.sub) {
      throw new Error('Invalid access token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new Error('User not found');
    }

    await client.join(this.userRoom(payload.sub));
  }

  private extractToken(client: Socket): string {
    const authToken: unknown = client.handshake.auth.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const authorization = client.handshake.headers.authorization;
    if (authorization?.startsWith('Bearer ')) {
      return authorization.slice(7);
    }

    throw new Error('Missing access token');
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }
}
