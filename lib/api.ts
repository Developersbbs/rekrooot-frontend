export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    throw new Error("Missing NEXT_PUBLIC_API_BASE_URL in env");
  }

  const { token, headers, ...rest } = options;

  const defaultHeaders: HeadersInit = {};
  if (token) {
    defaultHeaders["Authorization"] = `Bearer ${token}`;
  }
  if (rest.body && typeof rest.body === 'string') {
    defaultHeaders["Content-Type"] = "application/json";
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers: {
      ...defaultHeaders,
      ...(headers || {}),
    },
  });

  const data = await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new ApiError(res.status, data?.message || "Request failed", data);
  }

  return data as T;
}