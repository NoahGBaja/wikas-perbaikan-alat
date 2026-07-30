"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const POPSTATE_RECOVERY_DELAY_MS = 1500;

/**
 * Browser Back/Forward can leave the previous App Router screen visible while
 * a slow RSC request is pending. If the URL has changed but Next has not
 * rendered that pathname shortly afterward, force a normal document load.
 */
export default function NavigationRecovery() {
  const pathname = usePathname();
  const renderedPathnameRef = useRef(pathname);
  const recoveryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    renderedPathnameRef.current = pathname;

    if (recoveryTimerRef.current !== null) {
      window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
  }, [pathname]);

  useEffect(() => {
    function handlePopState() {
      const targetPathname = window.location.pathname;

      if (recoveryTimerRef.current !== null) {
        window.clearTimeout(recoveryTimerRef.current);
      }

      recoveryTimerRef.current = window.setTimeout(() => {
        recoveryTimerRef.current = null;

        if (
          window.location.pathname === targetPathname &&
          renderedPathnameRef.current !== targetPathname
        ) {
          window.location.reload();
        }
      }, POPSTATE_RECOVERY_DELAY_MS);
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);

      if (recoveryTimerRef.current !== null) {
        window.clearTimeout(recoveryTimerRef.current);
      }
    };
  }, []);

  return null;
}
