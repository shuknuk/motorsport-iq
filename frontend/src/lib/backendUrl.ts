export function resolveBackendUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();
  if (configuredUrl) return configuredUrl;

  if (typeof window === 'undefined') {
    return 'http://localhost:4000';
  }

  if (window.location.hostname === 'localhost') {
    return 'http://localhost:4000';
  }

  return window.location.origin;
}
