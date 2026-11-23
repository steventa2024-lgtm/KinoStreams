'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/components/AuthGate';
import { BottomNav } from '@/components/BottomNav';
import { FloatingMiniPlayer } from '@/components/FloatingMiniPlayer';
import { Footer } from '@/components/Footer';
import { KinoProvider } from '@/components/KinoProvider';
import { MediaDetailsProvider } from '@/components/MediaDetails';
import { RouteMotion } from '@/components/RouteMotion';
import { SearchOverlay } from '@/components/SearchOverlay';
import { SourceManagerModal } from '@/components/SourceManagerModal';
import { ViewerProfilesProvider } from '@/components/ViewerProfilesProvider';
import { ViewerProfileGate } from '@/components/ViewerProfileScreen';
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
    <ViewerProfilesProvider key={user?.email || 'anon'}>
    <ViewerProfileGate>
    <KinoProvider key={user?.email || 'anon'}>
      <MediaDetailsProvider>
      <div className="kino-shell flex min-h-screen flex-col pb-20 md:pb-4">
        <RouteMotion>{children}</RouteMotion>
        <Footer />
      </div>
      <BottomNav />
      <FloatingMiniPlayer />
      <SearchOverlay />
      <SourceManagerModal />
      </MediaDetailsProvider>
    </KinoProvider>
    </ViewerProfileGate>
    </ViewerProfilesProvider>
  );
}
