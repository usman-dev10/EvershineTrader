/**
 * Tracks every live API call so the ET overlay stays until the screen is updated.
 */

type Listener = () => void;

let inflight = 0;
let lastCaption = "Loading...";
const listeners = new Set<Listener>();

export function beginPageLoad(caption?: string): void {
  inflight += 1;
  if (caption) lastCaption = caption;
  notify();
}

export function endPageLoad(): void {
  inflight = Math.max(0, inflight - 1);
  if (inflight === 0) lastCaption = "";
  notify();
}

export function getInflightLoads(): number {
  return inflight;
}

export function getLoadCaption(): string {
  return lastCaption;
}

export function subscribePageLoad(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  listeners.forEach((fn) => fn());
}
