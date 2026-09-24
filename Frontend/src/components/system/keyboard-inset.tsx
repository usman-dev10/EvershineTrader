"use client";

import { useEffect } from "react";

/** Keeps --kb-inset in sync with the on-screen keyboard (visualViewport). */
export function KeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const apply = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty(
        "--kb-inset",
        `${Math.round(inset)}px`,
      );
    };

    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      window.removeEventListener("orientationchange", apply);
      document.documentElement.style.setProperty("--kb-inset", "0px");
    };
  }, []);

  return null;
}

export function scrollFieldIntoView(el: HTMLElement): void {
  window.setTimeout(() => {
    el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  }, 80);
}
