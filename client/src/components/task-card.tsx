"use client";

import { useEffect, useState } from "react";
import { tasksApi } from "@/lib/api";
import type { Task, TaskStatus } from "@/types/api";

export type AuthorizedRequest = <T>(
  operation: (accessToken: string) => Promise<T>,
) => Promise<T>;

interface TaskCardProps {
  task: Task;
  authorize: AuthorizedRequest;
  onUpdated: (task: Task) => void;
  onDeleted: (taskId: string) => void;
}

export function TaskCard({
  task,
  authorize,
  onUpdated,
  onDeleted,
}: TaskCardProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
  }, [task.title, task.description]);

  async function run(operation: () => Promise<void>) {
    setPending(true);
    setError("");
    try {
      await operation();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось обновить задачу",
      );
    } finally {
      setPending(false);
    }
  }

  function updateStatus(status: TaskStatus) {
    void run(async () => {
      const updated = await authorize((token) =>
        tasksApi.update(token, task.id, { status }),
      );
      onUpdated(updated);
    });
  }

  function save() {
    void run(async () => {
      const updated = await authorize((token) =>
        tasksApi.update(token, task.id, {
          title,
          description: description.trim() || null,
        }),
      );
      onUpdated(updated);
      setEditing(false);
    });
  }

  function remove() {
    if (!window.confirm("Удалить задачу?")) {
      return;
    }
    void run(async () => {
      await authorize((token) => tasksApi.remove(token, task.id));
      onDeleted(task.id);
    });
  }

  return (
    <article className="task-card">
      {editing ? (
        <>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            required
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={5000}
            rows={3}
          />
          <div className="actions">
            <button disabled={pending || !title.trim()} onClick={save}>
              Сохранить
            </button>
            <button
              className="secondary"
              disabled={pending}
              onClick={() => setEditing(false)}
            >
              Отмена
            </button>
          </div>
        </>
      ) : (
        <>
          <h3>{task.title}</h3>
          {task.description && <p>{task.description}</p>}
          <label>
            Статус
            <select
              value={task.status}
              disabled={pending}
              onChange={(event) =>
                updateStatus(event.target.value as TaskStatus)
              }
            >
              <option value="TODO">К выполнению</option>
              <option value="IN_PROGRESS">В работе</option>
              <option value="DONE">Готово</option>
            </select>
          </label>
          <div className="actions">
            <button
              className="secondary"
              disabled={pending}
              onClick={() => setEditing(true)}
            >
              Изменить
            </button>
            <button className="danger" disabled={pending} onClick={remove}>
              Удалить
            </button>
          </div>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </article>
  );
}
