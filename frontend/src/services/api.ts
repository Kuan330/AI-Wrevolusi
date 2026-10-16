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

let sessionVersion = 0;
let renewalVersion = 0;
let sessionExpired = false;
let renewal: Promise<void> | null = null;

/** Invalidate pending requests when the active account or login changes. */
export function resetApiSession() {
  sessionVersion++;
  renewalVersion++;
  sessionExpired = false;
  renewal = null;
}

function expiredSession(): ApiError {
  if (!sessionExpired) {
    sessionExpired = true;
    if (typeof window !== "undefined") window.dispatchEvent(new Event("api-session-expired"));
  }
  return new ApiError("Your session expired. Log in again to continue. Your local drafts are kept.", 401, { code: "session_expired" });
}

function checkSession(version: number, signal?: AbortSignal | null) {
  signal?.throwIfAborted();
  if (version !== sessionVersion) throw new ApiError("Your account changed. Please try again.", 409, { code: "session_changed" });
}

/** Waiters keep their own deadline/cancellation without cancelling shared renewal. */
function waitForRenewal(pending: Promise<void>, signal?: AbortSignal | null): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", abort, { once: true });
    pending.then(resolve, reject).finally(() => signal?.removeEventListener("abort", abort));
  });
}

function renewSession(version: number): Promise<void> {
  if (renewal) return renewal;
  const pending = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST", credentials: "include", signal: controller.signal,
        headers: { "Content-Type": "application/json" },
      });
      checkSession(version);
      if (response.status === 401) throw expiredSession();
      if (!response.ok) {
        const body = await parseResponseBody(response);
        throw new ApiError(apiErrorDetail(body, response.status), response.status, body);
      }
      renewalVersion++;
    } finally {
      clearTimeout(timer);
    }
  })();
  renewal = pending;
  // Handle both outcomes without leaving an unobserved rejected promise.
  void pending.then(() => { if (renewal === pending) renewal = null; }, () => { if (renewal === pending) renewal = null; });
  return pending;
}

/** Shared cookie renewal for JSON endpoints and binary PDF rendering. */
export async function sessionFetch(path: string, init: RequestInit): Promise<Response> {
  const authentication = /^\/(?:auth(?:\/|$)|account\/(?:login|register)(?:[/?]|$))/.test(path);
  const changesSession = /^\/(?:auth\/(?:login|logout)|account\/(?:login|register))$/.test(path);
  const version = sessionVersion, renewed = renewalVersion;
  checkSession(version, init.signal);
  // Finish the old cookie rotation before login/logout can install different cookies.
  if (changesSession && renewal) {
    await waitForRenewal(renewal.catch(() => {}), init.signal);
    checkSession(version, init.signal);
  }
  if (!authentication && sessionExpired) throw expiredSession();
  let response = await fetch(`${API_BASE_URL}${path}`, { ...init, credentials: "include" });
  init.signal?.throwIfAborted();
  // Existing callers guard their normal results; renewal must never cross accounts.
  if (response.status === 401 || authentication) checkSession(version, init.signal);
  if (response.status === 401 && !authentication) {
    if (sessionExpired) throw expiredSession();
    if (renewed === renewalVersion) await waitForRenewal(renewSession(version), init.signal);
    checkSession(version, init.signal);
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, credentials: "include" });
    checkSession(version, init.signal);
    if (response.status === 401) throw expiredSession();
  }
  if (response.ok && changesSession) resetApiSession();
  return response;
}

const request = async <T>(
  path: string,
  init?: RequestInit,
  // Deployed serverless + shared database hosts answer in 1-2s when idle, but
  // concurrent testers can push a real response past 8s. A 4s budget aborted
  // requests the server had already answered, which surfaced as page-level
  // "try again" errors. Endpoints that need a different budget pass their own.
  timeoutMs = 20000,
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
    const response = await sessionFetch(path, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(aiRequest && modelVersion ? { "X-AIW-Models": modelVersion } : {}),
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });

    const body = await parseResponseBody(response);
    if (aiRequest && (modelsChanged || modelVersion !== modelPreferenceSnapshot())) { modelsChanged = true; throw new ApiError("AI models changed. Try again with the new settings.", 409, { code: "ai_models_changed" }); }
    if (!response.ok) {
      const detail = apiErrorDetail(body, response.status);
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
