'use client';

import { useEffect, useState } from 'react';

/** Retain decorative exit frames without delaying the state/action that closed a UI. */
export function usePresence(open: boolean, exitDuration = 180) {
  const [retained, setRetained] = useState(open);

  useEffect(() => {
    if (open) {
      setRetained(true);
      return;
    }
    if (!retained) return;

    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finish = () => setRetained(false);
    if (preference.matches) {
      finish();
      return;
    }

    const timer = window.setTimeout(finish, exitDuration);
    const onPreferenceChange = () => {
      if (preference.matches) finish();
    };
    preference.addEventListener('change', onPreferenceChange);
    return () => {
      window.clearTimeout(timer);
      preference.removeEventListener('change', onPreferenceChange);
    };
  }, [open, retained, exitDuration]);

  return { present: open || retained, exiting: !open && retained };
}
