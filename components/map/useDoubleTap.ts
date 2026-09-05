import { useCallback, useEffect, useRef } from 'react';

/** How long a second tap has to arrive to count as part of the first. */
export const DOUBLE_TAP_MS = 280;

/**
 * One tap does one thing, two do another.
 *
 * The single-tap action is held back until the window closes, because it
 * cannot be taken back once it has run: on the map a single tap opens or
 * closes a point's branches, and firing that before the second tap arrives
 * would make every double tap flicker the sky on its way to the detail.
 */
export function useDoubleTap(
  onSingle: () => void,
  onDouble: () => void,
  delay = DOUBLE_TAP_MS
): () => void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const single = useRef(onSingle);
  const double = useRef(onDouble);
  single.current = onSingle;
  double.current = onDouble;

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      double.current();
      return;
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      single.current();
    }, delay);
  }, [delay]);
}
