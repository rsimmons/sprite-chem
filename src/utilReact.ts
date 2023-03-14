import { useRef } from "react";

/**
 * Ensure that the given value never changes. If it does, throw an exception.
 */
export function useConstant<T>(v: T): void {
  const ref = useRef<T>(v);
  if (!Object.is(v, ref.current)) {
    throw new Error('useConstant value changed');
  }
}
