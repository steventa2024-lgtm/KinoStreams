'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { stopGlobalPlayback } from '@/lib/playback-cleanup';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Search, Settings } from 'lucide-react';
import { useKino } from '@/components/KinoProvider';
import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils';

export interface TopBarFilterPill {
  label: string;
  href?: string;
  active?: boolean;
  onClick?: () => void;
}

interface TopBarProps {
  showBack?: boolean;
  backHref?: string;
  title?: string;
  filterPills?: TopBarFilterPill[];
  solid?: boolean;
}

export function TopBar({
  showBack = false,
  backHref,
  title,
  filterPills,
  solid = false,
}: TopBarProps) {
  const [scrolled, setScrolled] = useState(false);
  const { openSearch, openSources } = useKino();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isElevated = solid || scrolled;

  const defaultPills: TopBarFilterPill[] = [
    { label: 'All', href: '/', active: pathname === '/' },
    { label: 'Sports', href: '/sports', active: pathname.startsWith('/sports') },
    { label: 'Live TV', href: '/live', active: pathname.startsWith('/live') },
    { label: 'Movies & Shows', href: '/movies', active: pathname.startsWith('/movies') },
    { label: 'Anime', href: '/anime', active: pathname.startsWith('/anime') },
  ];

  const pills = filterPills || (showBack ? [] : defaultPills);

  const handleBack = () => {
    stopGlobalPlayback();
    if (backHref) {
      router.push(backHref);
    } else if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  return (
    <header
      className={cn(
        'fixed top-0 right-0 left-0 z-30 pt-safe transition-all duration-300 md:left-20',
        isElevated
          ? 'border-b border-white/[0.08] bg-[#09090B]/85 backdrop-blur-xl'
          : 'bg-gradient-to-b from-[#09090B]/85 via-[#09090B]/40 to-transparent'
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        {/* Left: Back arrow or Editorial Wordmark + Optional Desktop Pills */}
        <div className="flex min-w-0 items-center gap-4 lg:gap-7">
          {showBack ? (
            <button
              type="button"
              onClickCapture={stopGlobalPlayback}
              onClick={handleBack}
              className="flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-[#121215]/75 px-3.5 py-1.5 text-sm font-medium text-[#FAFAFA] backdrop-blur-md transition hover:border-[#D4AF37]/40 hover:text-[#E2C275]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="truncate max-w-[180px] sm:max-w-xs">
                {title || 'Back'}
              </span>
            </button>
          ) : (
            <Link
              href="/"
              onClickCapture={stopGlobalPlayback}
              className="flex shrink-0 items-center gap-2.5 group"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D4AF37]/40 bg-[#121215] text-[11px] font-serif font-bold text-[#D4AF37] transition group-hover:border-[#D4AF37]">
                K
              </span>
              <span className="flex flex-col leading-none">
                <span className="font-serif text-base sm:text-lg font-semibold tracking-[0.2em] text-[#FAFAFA]">
                  {siteConfig.wordmark}
                </span>
                <span className="hidden text-[9px] font-medium tracking-[0.22em] text-zinc-500 uppercase md:block mt-0.5">
                  by {siteConfig.creator}
                </span>
              </span>
            </Link>
          )}

          {pills.length > 0 && (
            <nav className="hidden items-center gap-1.5 lg:flex" aria-label="Categories">
              {pills.map((pill) => {
                const classes = cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-medium tracking-wide transition',
                  pill.active
                    ? 'bg-[#D4AF37]/15 text-[#E2C275] border border-[#D4AF37]/35'
                    : 'text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-white/[0.05] border border-transparent'
                );
                if (pill.href) {
                  return (
                    <Link
                      key={pill.label}
                      href={pill.href}
                      onClickCapture={stopGlobalPlayback}
                      className={classes}
                    >
                      {pill.label}
                    </Link>
                  );
                }
                return (
                  <button
                    key={pill.label}
                    type="button"
                    onClick={pill.onClick}
                    className={classes}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        {/* Right: Quick Search & Settings/Sources */}
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={openSearch}
            aria-label="Search KinoStream"
            className="flex h-9 items-center gap-2.5 rounded-full border border-white/[0.08] bg-[#121215]/75 px-3 sm:px-3.5 text-xs text-[#A1A1AA] backdrop-blur-md transition hover:border-[#D4AF37]/40 hover:text-[#FAFAFA]"
          >
            <Search className="h-4 w-4 text-[#D4AF37]" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-[#71717A] md:inline-block">
              ⌘K
            </kbd>
          </button>

          <button
            type="button"
            onClick={openSources}
            aria-label="Sources & Settings"
            title="Manage Playlists & Sources"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-[#121215]/75 text-[#A1A1AA] backdrop-blur-md transition hover:border-[#D4AF37]/40 hover:text-[#D4AF37]"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
