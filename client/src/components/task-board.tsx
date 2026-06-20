"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { backendOrigin, tasksApi } from "@/lib/api";
import type { Task, TaskStatus, TaskStatusEvent } from "@/types/api";
import { AuthorizedRequest, TaskCard } from "./task-card";

const columns: Array<{ status: TaskStatus; title: string }> = [
  { status: "TODO", title: "К выполнению" },
  { status: "IN_PROGRESS", title: "В работе" },
  { status: "DONE", title: "Готово" },
];

interface TaskBoardProps {
  accessToken: string;
  authorize: AuthorizedRequest;
}

export function TaskBoard({ accessToken, authorize }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTasks(await authorize((token) => tasksApi.list(token)));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось загрузить задачи",
      );
    } finally {
      setLoading(false);
    }
  }, [authorize]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    const socket = io(backendOrigin, {
      auth: { token: accessToken },
      transports: ["websocket"],
    });

    socket.on("task.status.changed", (event: TaskStatusEvent) => {
      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === event.id
            ? { ...task, status: event.status, updatedAt: event.timestamp }
            : task,
        ),
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken]);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const created = await authorize((token) =>
        tasksApi.create(token, {
          title,
          ...(description.trim() ? { description } : {}),
        }),
      );
      setTasks((currentTasks) => [created, ...currentTasks]);
      setTitle("");
      setDescription("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось создать задачу",
      );
    } finally {
      setPending(false);
    }
  }

  function replaceTask(updated: Task) {
    setTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === updated.id ? updated : task)),
    );
  }

  function removeTask(taskId: string) {
    setTasks((currentTasks) =>
      currentTasks.filter((task) => task.id !== taskId),
    );
  }

  return (
    <>
      <form className="create-form" onSubmit={createTask}>
        <input
          placeholder="Название задачи"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          required
        />
        <input
          placeholder="Описание"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={5000}
        />
        <button disabled={pending || !title.trim()} type="submit">
          Добавить
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p>Загрузка...</p>
      ) : (
        <section className="board">
          {columns.map((column) => (
            <div className="column" key={column.status}>
              <h2>{column.title}</h2>
              {tasks
                .filter((task) => task.status === column.status)
                .map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    authorize={authorize}
                    onUpdated={replaceTask}
                    onDeleted={removeTask}
                  />
                ))}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
