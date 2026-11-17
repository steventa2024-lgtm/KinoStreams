declare global {
  interface Window {
    __kinoStopPlayback?: () => void;
  }
}

const activeStoppers = new Set<() => void>();

/**
 * Synchronously tears down every active media player, HLS loader, and fetch
 * controller before Next.js initiates a route transition so navigation never
 * stalls on an active video decoder or state flush loop.
 */
export function stopGlobalPlayback(): void {
  if (typeof window === 'undefined') return;
  for (const stop of Array.from(activeStoppers)) {
    try {
      stop();
    } catch {
      // Ignore already-disposed media instances
    }
  }
  const externalStopper = window.__kinoStopPlayback;
  if (externalStopper && externalStopper !== stopGlobalPlayback) {
    try {
      externalStopper();
    } catch {
      // Ignore errors from stale listeners
    }
  }
}

/**
 * Registers a synchronous media teardown callback on `window.__kinoStopPlayback`.
 * Returns an unsubscribe handler for React effect cleanup.
 */
export function registerGlobalPlaybackStopper(stopper: () => void): () => void {
  activeStoppers.add(stopper);
  if (typeof window !== 'undefined') {
    window.__kinoStopPlayback = stopGlobalPlayback;
  }

  return () => {
    activeStoppers.delete(stopper);
    if (typeof window !== 'undefined' && activeStoppers.size === 0) {
      if (window.__kinoStopPlayback === stopGlobalPlayback) {
        delete window.__kinoStopPlayback;
      }
    }
  };
}
