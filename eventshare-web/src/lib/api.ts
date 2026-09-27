export class ApiClientError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

type Init = Omit<RequestInit, 'body'> & { json?: unknown };

export async function api<T>(path: string, init: Init = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`/api${path}`, {
    ...rest,
    credentials: 'same-origin',
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(res.status, data?.error?.code ?? 'ERROR', data?.error?.message ?? 'Ocurrió un error. Inténtalo de nuevo.');
  }
  return data as T;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Ocurrió un error. Inténtalo de nuevo.');
