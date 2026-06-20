import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ["mousemove", "keydown", "click", "scroll"];

/**
 * PRD NF-SC-05: session resume after idle time requires re-authentication
 * if idle exceeds `session_reauth_idle_minutes` (default 60).
 */
export function useIdleTimeout(idleMinutes: number, onIdle: () => void): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function reset() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(onIdle, idleMinutes * 60 * 1000);
    }

    reset();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, reset));

    return () => {
      if (timer.current) clearTimeout(timer.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, reset));
    };
  }, [idleMinutes, onIdle]);
}
