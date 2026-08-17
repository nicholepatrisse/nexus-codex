export type Result<Value, ErrorValue> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: ErrorValue };

export function success<Value>(value: Value): Result<Value, never> {
  return { ok: true, value };
}

export function failure<ErrorValue>(error: ErrorValue): Result<never, ErrorValue> {
  return { error, ok: false };
}
