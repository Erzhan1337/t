import { TaskStatus } from '@prisma/client';

export interface TaskStatusEvent {
  id: string;
  status: TaskStatus;
  timestamp: string;
}
