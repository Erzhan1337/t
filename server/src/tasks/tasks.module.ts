import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { TasksController } from './tasks.controller';
import { TasksGateway } from './tasks.gateway';
import { TasksRepository } from './tasks.repository';
import { TasksService } from './tasks.service';

@Module({
  imports: [UsersModule],
  controllers: [TasksController],
  providers: [TasksGateway, TasksRepository, TasksService],
})
export class TasksModule {}
