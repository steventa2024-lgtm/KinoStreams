'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Search, Settings } from 'lucide-react';
import { useKino } from '@/components/KinoProvider';
import { ProfileSwitcher } from '@/components/ProfileSwitcher';
import { siteConfig } from '@/config/site';
import { stopGlobalPlayback } from '@/lib/playback-cleanup';
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
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const defaultPills: TopBarFilterPill[] = [
    { label: 'Home', href: '/', active: pathname === '/' },
    { label: 'Movies', href: '/movies', active: pathname.startsWith('/movies') || pathname.startsWith('/platforms') },
    { label: 'Live TV', href: '/live', active: pathname.startsWith('/live') },
    { label: 'Sports', href: '/sports', active: pathname.startsWith('/sports') },
    { label: 'Anime', href: '/anime', active: pathname.startsWith('/anime') },
    { label: 'Library', href: '/library', active: pathname.startsWith('/library') },
  ];
  const pills = filterPills || defaultPills;

  const handleBack = () => {
    stopGlobalPlayback();
    if (backHref) router.push(backHref);
    else if (window.history.length > 1) router.back();
    else router.push('/');
  };

  return (
    <header className={cn('kino-topbar pt-safe', (solid || scrolled) && 'kino-topbar--elevated')}>
      <div className="kino-topbar__inner">
        <div className="kino-topbar__identity">
          {showBack ? (
            <button type="button" onClick={handleBack} className="kino-back" aria-label={title ? `Back from ${title}` : 'Go back'}>
              <ArrowLeft aria-hidden="true" size={18} />
              <span>{title || 'Back'}</span>
            </button>
          ) : (
            <Link href="/" onClickCapture={stopGlobalPlayback} className="kino-wordmark" aria-label={`${siteConfig.name} home`}>
              {siteConfig.wordmark}
            </Link>
          )}
        </div>

        <nav className="kino-nav" aria-label="Categories">
          {pills.map((pill) => pill.href ? (
            <Link
              key={pill.label}
              href={pill.href}
              onClickCapture={stopGlobalPlayback}
              className={cn('kino-nav__item', pill.active && 'kino-nav__item--active')}
              aria-current={pill.active ? 'page' : undefined}
            >
              {pill.label}
            </Link>
          ) : (
            <button
              key={pill.label}
              type="button"
              onClick={pill.onClick}
              className={cn('kino-nav__item', pill.active && 'kino-nav__item--active')}
              aria-pressed={pill.active}
            >
              {pill.label}
            </button>
          ))}
          <button type="button" onClick={openSearch} className="kino-nav__search" aria-label="Search KinoStream" title="Search (⌘K / Ctrl+K)">
            <Search size={14} aria-hidden="true" />
          </button>
        </nav>

        <div className="kino-topbar__actions">
          <button type="button" onClick={openSearch} className="kino-mobile-search" aria-label="Search KinoStream">
            <Search size={18} aria-hidden="true" />
          </button>
          <button type="button" onClick={openSources} className="kino-settings" aria-label="Sources & Settings" title="Manage Playlists & Sources">
            <Settings size={16} aria-hidden="true" />
          </button>
          <ProfileSwitcher />
        </div>
      </div>
    </header>
  );
}
