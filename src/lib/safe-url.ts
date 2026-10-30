export function safeExternalUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

export function externalUrlError(value: unknown): string | null {
  return value == null || value === '' || safeExternalUrl(value) ? null : 'Use a valid http:// or https:// link without embedded credentials.';
}
