'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, Clapperboard, Home, Radio, Sparkles, Trophy } from 'lucide-react';
import { stopGlobalPlayback } from '@/lib/playback-cleanup';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Home', shortLabel: 'Home', icon: Home },
  { href: '/sports', label: 'Sports', shortLabel: 'Sports', icon: Trophy },
  { href: '/live', label: 'Live TV', shortLabel: 'Live TV', icon: Radio },
  { href: '/movies', label: 'Movies & Shows', shortLabel: 'Movies', icon: Clapperboard },
  { href: '/anime', label: 'Anime', shortLabel: 'Anime', icon: Sparkles },
  { href: '/library', label: 'Library', shortLabel: 'Library', icon: Bookmark },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const activeIndex = NAV_ITEMS.findIndex((item) => item.href === '/' ? pathname === '/' : pathname.startsWith(item.href));

  return (
    <nav aria-label="Primary navigation" className="kino-bottom-nav pb-safe">
      <div className="kino-bottom-nav__items">
        <span
          className="kino-bottom-nav__indicator"
          aria-hidden="true"
          style={{ transform: `translateX(${Math.max(0, activeIndex) * 100}%)`, opacity: activeIndex < 0 ? 0 : 1 }}
        />
        {NAV_ITEMS.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClickCapture={stopGlobalPlayback}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={cn('kino-bottom-nav__item', active && 'kino-bottom-nav__item--active')}
            >
              <span className="kino-bottom-nav__icon"><Icon aria-hidden="true" size={18} strokeWidth={active ? 2.2 : 1.7} /></span>
              <span>{item.shortLabel}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
