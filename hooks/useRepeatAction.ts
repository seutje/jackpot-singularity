import { useEffect, useRef, useCallback } from 'react';

/**
 * A hook that triggers a callback repeatedly while the user holds down a mouse button or touch.
 * Supports accelerating frequency the longer the button is held.
 * 
 * @param callback The function to execute.
 * @param disabled Whether the action is disabled (stops repetition if becomes true).
 * @param baseInterval The initial speed in ms between repeats.
 * @param accelerationDelay Time in ms before acceleration starts (default 500ms).
 * @param minInterval Maximum speed (minimum interval) in ms (default 30ms).
 */
const useRepeatAction = (
  callback: () => void,
  disabled: boolean,
  baseInterval: number = 150,
  accelerationDelay: number = 500,
  minInterval: number = 30
) => {
  const timerRef = useRef<number | null>(null);
  const callbackRef = useRef(callback);
  const startTimeRef = useRef<number>(0);

  // Keep callback ref fresh
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Stop if disabled state changes while holding
  useEffect(() => {
    if (disabled) {
      stop();
    }
  }, [disabled, stop]);

  // Clean up on unmount
  useEffect(() => {
    return () => stop();
  }, [stop]);

  const start = useCallback((e: React.SyntheticEvent) => {
    if (disabled) return;

    // Use preventDefault to stop touch events from also triggering mouse events
    if (e.cancelable) {
      e.preventDefault();
    }

    // Execute immediately once
    callbackRef.current();
    startTimeRef.current = Date.now();

    // Start the recursive loop
    const runLoop = () => {
      const elapsed = Date.now() - startTimeRef.current;
      let currentDelay = baseInterval;

      // Acceleration Logic
      if (elapsed > accelerationDelay) {
        const timePastThreshold = elapsed - accelerationDelay;
        // Accelerate over 2 seconds to max speed
        const rampUpDuration = 2000;
        const decay = Math.max(0, 1 - (timePastThreshold / rampUpDuration));
        // Linearly interpolate between baseInterval and minInterval based on decay
        currentDelay = minInterval + (baseInterval - minInterval) * decay;
      }

      timerRef.current = window.setTimeout(() => {
        // Check if we were stopped in the meantime via disabled prop effect
        if (timerRef.current !== null) {
          callbackRef.current();
          runLoop();
        }
      }, currentDelay);
    };

    runLoop();
  }, [disabled, baseInterval, accelerationDelay, minInterval]);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
  };
};

export default useRepeatAction;