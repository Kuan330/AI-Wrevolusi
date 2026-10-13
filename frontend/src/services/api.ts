import { isAIRequest, modelPreferenceSnapshot, subscribeModelPreferences } from "../infrastructure/storage/modelPreferences.ts";
const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? "/api/v1";

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;
  readonly code?: string;
  readonly fields: (string | number)[][];

  constructor(message: string, status: number, metadata?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = message;
    const body = metadata && typeof metadata === "object" ? metadata as Record<string, unknown> : {};
    if (typeof body.code === "string" && /^[a-z][a-z0-9_]{0,63}$/.test(body.code)) this.code = body.code;
    this.fields = Array.isArray(body.fields) ? body.fields.slice(0, 5).filter((path): path is (string | number)[] =>
      Array.isArray(path) && path.length <= 18 && path.every(part =>
        typeof part === "number" ? Number.isInteger(part) && part >= 0 && part <= 10000 :
          typeof part === "string" && /^[a-z_]{1,64}$/.test(part)),
    ).map(path => [...path]) : [];
  }
}

/** FastAPI may return a list of validation failures rather than one detail string. */
export function apiErrorDetail(body: unknown, status: number): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = body.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      const messages = detail.filter((item): item is { msg: string } =>
        Boolean(item) && typeof item === "object" && "msg" in item && typeof item.msg === "string",
      ).map(item => item.msg.replace(/^Value error,\s*/i, "").slice(0, 500));
      if (messages.length) return [...new Set(messages)].slice(0, 3).join(" ");
    }
  }
  return `Request failed with status ${status}`;
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

function operationNotice(path: string, method: string | undefined, error?: unknown) {
  const savedPost = method === "POST" && ["/learning/progress", "/learning/checkin", "/progress-reviews"].includes(path);
  if (typeof window === "undefined" || (!savedPost && !["PUT", "PATCH", "DELETE"].includes(method ?? ""))) return;
  window.dispatchEvent(new CustomEvent("api-operation-result", { detail: { type: error ? "error" : "success", content: error ? (error instanceof Error ? error.message : "Could not complete the operation. Please try again.") : method === "DELETE" ? "Deleted successfully." : "Changes saved successfully." } }));
}

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
  const aiRequest = isAIRequest(path), modelVersion = modelPreferenceSnapshot();
  let modelsChanged = false;
  const unsubscribeModels = aiRequest ? subscribeModelPreferences(() => { modelsChanged = true; controller.abort(); }) : () => {};
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
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(aiRequest && modelVersion ? { "X-AIW-Models": modelVersion } : {}),
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });

    // The access cookie lasts 30 minutes. If it has gone but the sign-in is still valid, renew it once and repeat the request.
    // A 401 means the request was refused before it did anything, so repeating a POST is safe.
    if (response.status === 401 && retrySession && canRenewSession(path) && await renewSession(timeoutMs)) {
      return request<T>(path, init, timeoutMs, false);
    }
    const body = await parseResponseBody(response);
    if (aiRequest && (modelsChanged || modelVersion !== modelPreferenceSnapshot())) { modelsChanged = true; throw new ApiError("AI models changed. Try again with the new settings.", 409, { code: "ai_models_changed" }); }
    if (!response.ok) {
      // A refused request after a failed renewal means the sign-in has ended. Say so in plain words.
      const detail = response.status === 401 && canRenewSession(path) ? "Your sign-in has ended. Please sign in again." : apiErrorDetail(body, response.status);
      throw new ApiError(detail, response.status, body);
    }

    if (response.status !== 202) operationNotice(path, init?.method);
    return body as T;
  } catch (error) {
    if (!externalSignal?.aborted) operationNotice(path, init?.method, error);
    if (modelsChanged) throw new ApiError("AI models changed. Try again with the new settings.", 409, { code: "ai_models_changed" });
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("Request timed out", 408);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    unsubscribeModels();
    externalSignal?.removeEventListener("abort", relayExternalAbort);
  }
};

/** Sign-in and account lookups handle their own expiry. */
const canRenewSession = (path: string) => !/^\/(auth\/|account\/(login|register|me)(\?|$))/.test(path);
let renewing: Promise<boolean> | null = null;
/** One renewal at a time, so several expired requests do not fight over the refresh token. */
const renewSession = (timeoutMs: number): Promise<boolean> => {
  renewing ??= request("/auth/refresh", { method: "POST" }, timeoutMs, false).then(() => true, () => false).finally(() => { renewing = null; });
  return renewing;
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
  postBlob: <T>(path: string, audio: Blob, timeoutMs: number, signal: AbortSignal) =>
    request<T>(path, { method: "POST", body: audio, headers: { "Content-Type": audio.type }, signal, cache: "no-store" }, timeoutMs),
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
