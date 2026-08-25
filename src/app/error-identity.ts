export function getOpaqueErrorId(error: Error & { digest?: string }): string {
  if (error.digest && /^[a-zA-Z0-9_-]{1,64}$/.test(error.digest)) {
    return `NC-${error.digest}`;
  }

  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `NC-${randomId}`;
}

