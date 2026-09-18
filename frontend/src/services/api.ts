const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? "/api/v1";

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = message;
  }
}

const parseResponseBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
};

const request = async <T>(
  path: string,
  init?: RequestInit,
  // Deployed serverless + shared database hosts answer in 1-2s when idle, but
  // concurrent testers can push a real response past 8s. A 4s budget aborted
  // requests the server had already answered, which surfaced as page-level
  // "try again" errors. Endpoints that need a different budget pass their own.
  timeoutMs = 20000,
  retrySession = true,
): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = init?.signal ?? null;
  const relayExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", relayExternalAbort, {
        once: true,
      });
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      ...init,
      signal: controller.signal,
    });

    if (response.status === 401 && path === "/account/workspace" && retrySession) {
      await request("/auth/refresh", { method: "POST" }, timeoutMs, false);
      return request<T>(path, init, timeoutMs, false);
    }
    const body = await parseResponseBody(response);
    if (!response.ok) {
      const detail =
        typeof body === "object" &&
        body !== null &&
        "detail" in body &&
        typeof body.detail === "string"
          ? body.detail
          : `Request failed with status ${response.status}`;
      throw new ApiError(detail, response.status);
    }

    return body as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("Request timed out", 408);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", relayExternalAbort);
  }
};

export const api = {
  get: <T>(path: string, signal?: AbortSignal, timeoutMs?: number) =>
    request<T>(path, { method: "GET", signal }, timeoutMs),
  post: <T, TBody = unknown>(
    path: string,
    payload?: TBody,
    timeoutMs?: number,
    signal?: AbortSignal,
  ) =>
    request<T>(
      path,
      {
        method: "POST",
        body: payload ? JSON.stringify(payload) : undefined,
        signal,
      },
      timeoutMs,
    ),
  put: <T, TBody = unknown>(path: string, payload?: TBody) =>
    request<T>(path, {
      method: "PUT",
      body: payload ? JSON.stringify(payload) : undefined,
    }),
  patch: <T, TBody = unknown>(path: string, payload?: TBody) =>
    request<T>(path, {
      method: "PATCH",
      body: payload ? JSON.stringify(payload) : undefined,
    }),
  delete: <T = null>(path: string) =>
    request<T>(path, {
      method: "DELETE",
    }),
};
