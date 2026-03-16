import { resolveBackendUrl } from './backendUrl';

export function getApiUrl(path: string): string {
  return `${resolveBackendUrl()}${path}`;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(getApiUrl(path), {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}
