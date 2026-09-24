"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { captionForPath } from "@/lib/page-caption";
import {
  getInflightLoads,
  getLoadCaption,
  subscribePageLoad,
} from "@/lib/page-load-bus";

const MIN_VISIBLE_MS = 400;

export function EtPageLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [caption, setCaption] = useState(() => captionForPath(pathname));

  useEffect(() => {
    setCaption(captionForPath(pathname));
    setVisible(true);
    let shownAt = Date.now();
    let hideTimer: number | undefined;
    let cancelled = false;

    const sync = () => {
      if (cancelled) return;
      const busy = getInflightLoads() > 0;
      const action = getLoadCaption();
      setCaption(action || captionForPath(pathname));

      if (busy) {
        window.clearTimeout(hideTimer);
        shownAt = Date.now();
        setVisible(true);
        return;
      }

      const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt));
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!cancelled && getInflightLoads() === 0) {
              setVisible(false);
            }
          });
        });
      }, wait);
    };

    const unsub = subscribePageLoad(sync);
    sync();

    return () => {
      cancelled = true;
      window.clearTimeout(hideTimer);
      unsub();
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--surface)]"
      role="status"
      aria-live="polite"
      aria-label={caption}
    >
      <div className="et-logo" aria-hidden>
        <span className="et-logo__ring" />
        <span className="et-logo__mark">ET</span>
      </div>
      <p className="mt-6 font-[family-name:var(--font-display)] text-base text-[var(--ink)] sm:text-lg">
        {caption}
      </p>
    </div>
  );
}
