"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthForm } from "@/components/auth-form";
import { TaskBoard } from "@/components/task-board";
import type { AuthorizedRequest } from "@/components/task-card";
import { ApiError, authApi } from "@/lib/api";
import type { AuthResponse } from "@/types/api";

export default function Home() {
  const [session, setSession] = useState<AuthResponse | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      try {
        setSession(await authApi.refresh());
      } catch {
        setSession(null);
      } finally {
        setInitializing(false);
      }
    }

    void restoreSession();
  }, []);

  const authorize: AuthorizedRequest = useCallback(
    async <T,>(operation: (accessToken: string) => Promise<T>) => {
      if (!session) {
        throw new Error("Требуется авторизация");
      }

      try {
        return await operation(session.accessToken);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
          throw error;
        }

        try {
          const refreshed = await authApi.refresh();
          setSession(refreshed);
          return await operation(refreshed.accessToken);
        } catch (refreshError) {
          setSession(null);
          throw refreshError;
        }
      }
    },
    [session],
  );

  async function logout() {
    try {
      await authorize((token) => authApi.logout(token));
    } catch {
      // Local logout still happens if the backend session is already invalid.
    } finally {
      setSession(null);
    }
  }

  if (initializing) {
    return <main className="centered">Загрузка...</main>;
  }

  if (!session) {
    return <AuthForm onAuthenticated={setSession} />;
  }

  return (
    <main className="app-shell">
      <header className="header">
        <div>
          <h1>Задачи</h1>
          <span>{session.user.email}</span>
        </div>
        <button className="secondary" onClick={() => void logout()}>
          Выйти
        </button>
      </header>
      <TaskBoard accessToken={session.accessToken} authorize={authorize} />
    </main>
  );
}
