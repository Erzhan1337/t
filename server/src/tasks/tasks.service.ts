import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksGateway } from './tasks.gateway';
import { TasksRepository } from './tasks.repository';

@Injectable()
export class TasksService {
  constructor(
    private readonly tasksRepository: TasksRepository,
    private readonly tasksGateway: TasksGateway,
  ) {}

  findAll(userId: string) {
    return this.tasksRepository.findAllByUserId(userId);
  }

  create(userId: string, dto: CreateTaskDto) {
    return this.tasksRepository.create(userId, dto.title, dto.description);
  }

  async update(userId: string, id: string, dto: UpdateTaskDto) {
    if (
      dto.title === undefined &&
      dto.description === undefined &&
      dto.status === undefined
    ) {
      throw new BadRequestException('At least one field must be provided');
    }

    const currentTask = await this.tasksRepository.findByIdAndUserId(
      id,
      userId,
    );
    if (!currentTask) {
      throw new NotFoundException('Task not found');
    }

    try {
      const task = await this.tasksRepository.update(id, userId, dto);
      if (dto.status !== undefined && dto.status !== currentTask.status) {
        this.tasksGateway.emitStatusChanged(userId, {
          id: task.id,
          status: task.status,
          timestamp: new Date().toISOString(),
        });
      }
      return task;
    } catch (error: unknown) {
      this.rethrowIfTaskWasNotFound(error);
      throw error;
    }
  }

  async delete(userId: string, id: string): Promise<void> {
    try {
      await this.tasksRepository.delete(id, userId);
    } catch (error: unknown) {
      this.rethrowIfTaskWasNotFound(error);
      throw error;
    }
  }

  private rethrowIfTaskWasNotFound(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException('Task not found');
    }
  }
}
