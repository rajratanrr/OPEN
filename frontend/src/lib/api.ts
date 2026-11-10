const base = import.meta.env.VITE_API_BASE_URL || "";
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
let refreshing: Promise<boolean> | null = null;
async function refresh() {
  if (!refreshing)
    refreshing = fetch(base + "/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { "X-Roadsaathi": "1" },
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  return refreshing;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("X-Roadsaathi", "1");
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const response = await fetch(base + "/api/v1" + path, {
    ...options,
    headers,
    credentials: "include",
  });
  if (
    response.status === 401 &&
    !retried &&
    !path.startsWith("/auth/login") &&
    !path.startsWith("/auth/register") &&
    !path.startsWith("/auth/refresh") &&
    (await refresh())
  )
    return api<T>(path, options, true);
  const data = await response
    .json()
    .catch(() => ({ message: "The server returned an unreadable response" }));
  if (!response.ok)
    throw new ApiError(
      data.message || "The request could not be completed",
      response.status,
    );
  return data as T;
}
export const post = <T>(path: string, data?: unknown) =>
  api<T>(path, {
    method: "POST",
    body: data === undefined ? undefined : JSON.stringify(data),
  });
export const patch = <T>(path: string, data?: unknown) =>
  api<T>(path, {
    method: "PATCH",
    body: data === undefined ? undefined : JSON.stringify(data),
  });
export const queryString = (params: Record<string, unknown>) =>
  new URLSearchParams(
    Object.entries(params)
      .filter(
        ([, v]) => v !== undefined && v !== null && v !== "" && v !== "ALL",
      )
      .map(([k, v]) => [k, String(v)]),
  ).toString();
export async function upload(image: Blob) {
  const form = new FormData();
  form.append("image", image, "road-evidence.jpg");
  return api<{ id: string; url: string }>("/evidence", {
    method: "POST",
    body: form,
  });
}
