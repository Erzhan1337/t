import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class TasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllByUserId(userId: string) {
    return this.prisma.task.findMany({
      where: { userId },
      select: taskSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  create(userId: string, title: string, description?: string | null) {
    return this.prisma.task.create({
      data: { userId, title, description },
      select: taskSelect,
    });
  }

  findByIdAndUserId(id: string, userId: string) {
    return this.prisma.task.findFirst({
      where: { id, userId },
      select: taskSelect,
    });
  }

  update(id: string, userId: string, data: Prisma.TaskUpdateInput) {
    return this.prisma.task.update({
      where: { id, userId },
      data,
      select: taskSelect,
    });
  }

  delete(id: string, userId: string) {
    return this.prisma.task.delete({
      where: { id, userId },
      select: { id: true },
    });
  }
}
