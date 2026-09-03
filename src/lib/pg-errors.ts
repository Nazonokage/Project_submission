export function pgErrorCode(err: unknown): string | undefined {
  let cur: unknown = err;
  for (let i = 0; i < 6 && cur; i++) {
    if (typeof cur !== 'object' || !cur) break;
    const rec = cur as Record<string, unknown>;
    if (typeof rec.code === 'string' && /^\d{5}$/.test(rec.code)) return rec.code;
    cur = rec.cause ?? rec.error ?? rec.originalError;
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err ?? '');
}

export function isUndefinedColumn(err: unknown) {
  return pgErrorCode(err) === '42703' || /column .* does not exist/i.test(errorMessage(err));
}

export function isUndefinedTable(err: unknown) {
  return pgErrorCode(err) === '42P01' || /relation .* does not exist/i.test(errorMessage(err));
}

export function isSchemaDrift(err: unknown) {
  return isUndefinedColumn(err) || isUndefinedTable(err);
}
