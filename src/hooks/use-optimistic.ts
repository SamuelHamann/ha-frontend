import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Shows a requested value straight away, before Home Assistant reports it back.
 *
 * A thermostat takes a moment to acknowledge a new setpoint; without this the number would
 * snap back to the old one between the tap and the device catching up, and a second tap
 * would compute from a stale figure. The override drops as soon as the entity reports the
 * value that was asked for, and after `timeoutMs` regardless — so a device that never
 * complies goes back to telling the truth rather than lying indefinitely.
 */
export function useOptimistic<T>(actual: T, timeoutMs = 8000) {
  const [local, setLocal] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const request = useCallback(
    (value: T) => {
      setLocal(value);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setLocal(null), timeoutMs);
    },
    [timeoutMs],
  );

  const settled = local === null || Object.is(local, actual);
  return [settled ? actual : (local as T), request, !settled] as const;
}
