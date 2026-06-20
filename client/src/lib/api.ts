import type {
  AuthResponse,
  CreateTaskInput,
  Task,
  UpdateTaskInput,
} from "@/types/api";

export const backendOrigin = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
).replace(/\/$/, "");

const apiBaseUrl = `${backendOrigin}/api`;

interface ErrorResponse {
  message?: string | string[];
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) {
    headers.set("content-type", "application/json");
  }
  if (accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    let message = `Ошибка запроса (${response.status})`;
    try {
      const body = (await response.json()) as ErrorResponse;
      if (Array.isArray(body.message)) {
        message = body.message.join(", ");
      } else if (body.message) {
        message = body.message;
      }
    } catch {
      // The backend may return an empty or non-JSON error response.
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

function authRequest(path: string, email: string, password: string) {
  return request<AuthResponse>(path, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export const authApi = {
  register: (email: string, password: string) =>
    authRequest("/auth/register", email, password),
  login: (email: string, password: string) =>
    authRequest("/auth/login", email, password),
  refresh: () => request<AuthResponse>("/auth/refresh", { method: "POST" }),
  logout: (accessToken: string) =>
    request<void>("/auth/logout", { method: "POST" }, accessToken),
};

export const tasksApi = {
  list: (accessToken: string) =>
    request<Task[]>("/tasks", {}, accessToken),
  create: (accessToken: string, input: CreateTaskInput) =>
    request<Task>(
      "/tasks",
      { method: "POST", body: JSON.stringify(input) },
      accessToken,
    ),
  update: (accessToken: string, id: string, input: UpdateTaskInput) =>
    request<Task>(
      `/tasks/${id}`,
      { method: "PATCH", body: JSON.stringify(input) },
      accessToken,
    ),
  remove: (accessToken: string, id: string) =>
    request<void>(`/tasks/${id}`, { method: "DELETE" }, accessToken),
};
