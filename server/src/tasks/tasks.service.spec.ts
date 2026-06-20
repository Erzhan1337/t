import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { TasksGateway } from './tasks.gateway';
import { TasksRepository } from './tasks.repository';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  const userId = 'c43cc5af-b31d-42d4-9082-c80464ad5a0f';
  const task = {
    id: '84a070e7-3c4c-4a66-952f-34a3c12610e7',
    title: 'Task',
    description: null,
    status: TaskStatus.TODO,
    createdAt: new Date('2026-06-20T00:00:00.000Z'),
    updatedAt: new Date('2026-06-20T00:00:00.000Z'),
  };
  const tasksRepository = {
    findAllByUserId: jest.fn(),
    create: jest.fn(),
    findByIdAndUserId: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const tasksGateway = {
    emitStatusChanged: jest.fn(),
  };
  let service: TasksService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TasksService(
      tasksRepository as unknown as TasksRepository,
      tasksGateway as unknown as TasksGateway,
    );
  });

  it('rejects an empty update before accessing the database', async () => {
    await expect(service.update(userId, task.id, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tasksRepository.findByIdAndUserId).not.toHaveBeenCalled();
  });

  it('does not reveal whether another user owns a task', async () => {
    tasksRepository.findByIdAndUserId.mockResolvedValue(null);

    await expect(
      service.update(userId, task.id, { status: TaskStatus.IN_PROGRESS }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('emits the required event when the status changes', async () => {
    const updatedTask = { ...task, status: TaskStatus.IN_PROGRESS };
    tasksRepository.findByIdAndUserId.mockResolvedValue(task);
    tasksRepository.update.mockResolvedValue(updatedTask);

    await expect(
      service.update(userId, task.id, { status: TaskStatus.IN_PROGRESS }),
    ).resolves.toEqual(updatedTask);

    expect(tasksGateway.emitStatusChanged).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        id: task.id,
        status: TaskStatus.IN_PROGRESS,
        timestamp: expect.any(String) as string,
      }),
    );
  });

  it('does not emit an event when status remains unchanged', async () => {
    tasksRepository.findByIdAndUserId.mockResolvedValue(task);
    tasksRepository.update.mockResolvedValue(task);

    await service.update(userId, task.id, { status: TaskStatus.TODO });

    expect(tasksGateway.emitStatusChanged).not.toHaveBeenCalled();
  });
});
