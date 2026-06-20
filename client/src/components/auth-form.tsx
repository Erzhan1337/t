"use client";

import { FormEvent, useState } from "react";
import { authApi } from "@/lib/api";
import type { AuthResponse } from "@/types/api";

interface AuthFormProps {
  onAuthenticated: (response: AuthResponse) => void;
}

export function AuthForm({ onAuthenticated }: AuthFormProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response =
        mode === "login"
          ? await authApi.login(email, password)
          : await authApi.register(email, password);
      onAuthenticated(response);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Ошибка входа",
      );
    } finally {
      setPending(false);
    }
  }

  function changeMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setError("");
  }

  return (
    <main className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>{mode === "login" ? "Вход" : "Регистрация"}</h1>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </label>

        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            maxLength={128}
            required
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={pending}>
          {pending
            ? "Подождите..."
            : mode === "login"
              ? "Войти"
              : "Зарегистрироваться"}
        </button>

        <button
          type="button"
          className="link-button"
          onClick={() => changeMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Создать аккаунт" : "Уже есть аккаунт"}
        </button>
      </form>
    </main>
  );
}
