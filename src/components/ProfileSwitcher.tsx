'use client';

import { ChevronDown } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useKino } from '@/components/KinoProvider';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { useViewerProfiles } from '@/components/ViewerProfilesProvider';
import { stopGlobalPlayback } from '@/lib/playback-cleanup';

export function ProfileSwitcher() {
  const { activeProfile, openPicker } = useViewerProfiles();
  const { miniPlayer, closeMiniPlayer, closeSearch, closeSources } = useKino();
  const pathname = usePathname();
  const router = useRouter();

  if (!activeProfile) return null;

  const handleOpen = () => {
    closeSearch();
    closeSources();
    const watching = pathname.startsWith('/watch/') || pathname === '/sports/multiview';
    if (watching || miniPlayer) {
      stopGlobalPlayback();
      closeMiniPlayer();
      // Leaving the watch route also unmounts embedded third-party players.
      if (watching) router.push('/');
    }
    openPicker();
  };

  return (
    <button
      type="button"
      className="kino-profile-trigger"
      onClick={handleOpen}
      aria-label={`Switch profile, currently ${activeProfile.name}`}
      aria-haspopup="dialog"
      title={`Watching as ${activeProfile.name} · Switch profile`}
    >
      <ProfileAvatar avatarId={activeProfile.avatarId} />
      <span className="kino-profile-trigger__chevron"><ChevronDown size={12} aria-hidden="true" /></span>
    </button>
  );
}
