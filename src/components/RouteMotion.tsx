'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/** Animate the existing shell; never key or remount the page/provider tree. */
export function RouteMotion({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const contentRef = useRef<HTMLDivElement>(null);
  const isPlayer = pathname.startsWith('/watch/') || pathname === '/sports/multiview';

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content || isPlayer || typeof content.animate !== 'function') return;

    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches) return;

    // Opacity alone leaves fixed headers, ambient artwork and scroll positions
    // attached to the viewport. Playback routes never receive a transition.
    const animation = content.animate(
      [{ opacity: 0.68 }, { opacity: 1 }],
      { duration: 340, easing: 'cubic-bezier(.22, 1, .36, 1)' },
    );
    const onPreferenceChange = () => {
      if (preference.matches) animation.cancel();
    };
    preference.addEventListener('change', onPreferenceChange);

    return () => {
      preference.removeEventListener('change', onPreferenceChange);
      animation.cancel();
    };
  }, [pathname, isPlayer]);

  return (
    <div
      ref={contentRef}
      className="kino-shell__content kino-route-content flex-1"
      data-kino-motion={isPlayer ? 'player' : 'browse'}
    >
      {children}
    </div>
  );
}
