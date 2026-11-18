'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/components/AuthGate';
import { BottomNav } from '@/components/BottomNav';
import { FloatingMiniPlayer } from '@/components/FloatingMiniPlayer';
import { Footer } from '@/components/Footer';
import { KinoProvider } from '@/components/KinoProvider';
import { MediaDetailsProvider } from '@/components/MediaDetails';
import { SearchOverlay } from '@/components/SearchOverlay';
import { SourceManagerModal } from '@/components/SourceManagerModal';
import { setActiveUserScope } from '@/lib/storage';

export function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const { authenticated, user } = useAuth();

  // Bind per-account localStorage scope synchronously before KinoProvider mounts
  if (authenticated && user?.email) {
    setActiveUserScope(user.email);
  }

  useEffect(() => {
    setActiveUserScope(authenticated && user?.email ? user.email : null);
  }, [authenticated, user?.email]);

  if (!authenticated) {
    return <>{children}</>;
  }

  return (
    <KinoProvider key={user?.email || 'anon'}>
      <MediaDetailsProvider>
      <div className="kino-shell flex min-h-screen flex-col pb-20 md:pb-4">
        <div className="kino-shell__content flex-1">{children}</div>
        <Footer />
      </div>
      <BottomNav />
      <FloatingMiniPlayer />
      <SearchOverlay />
      <SourceManagerModal />
      </MediaDetailsProvider>
    </KinoProvider>
  );
}
