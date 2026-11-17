'use client';

import React from 'react';
import Link from 'next/link';
import { stopGlobalPlayback } from '@/lib/playback-cleanup';
import { usePathname } from 'next/navigation';
import {
  Bookmark,
  Clapperboard,
  Home,
  Radio,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Home', shortLabel: 'Home', icon: Home },
  { href: '/sports', label: 'Sports', shortLabel: 'Sports', icon: Trophy },
  { href: '/live', label: 'Live TV', shortLabel: 'Live TV', icon: Radio },
  { href: '/movies', label: 'Movies & Shows', shortLabel: 'Cinema', icon: Clapperboard },
  { href: '/anime', label: 'Anime', shortLabel: 'Anime', icon: Sparkles },
  { href: '/library', label: 'Library', shortLabel: 'Library', icon: Bookmark },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile-First Fixed Frosted-Glass Bottom Bar */}
      <nav
        aria-label="Primary navigation"
        className="fixed right-0 bottom-0 left-0 z-40 border-t border-white/[0.08] bg-[#09090B]/90 backdrop-blur-xl pb-safe md:hidden"
      >
        <div className="grid h-16 grid-cols-6 items-center px-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClickCapture={stopGlobalPlayback}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 py-1.5 transition-colors',
                  active ? 'text-[#D4AF37]' : 'text-[#71717A] hover:text-[#FAFAFA]'
                )}
              >
                <Icon
                  className={cn('h-4 w-4 sm:h-5 sm:w-5 transition-transform', active && 'scale-105')}
                  strokeWidth={active ? 2.2 : 1.75}
                />
                <span className="text-[9px] sm:text-[10px] font-medium tracking-wide truncate max-w-[58px]">
                  {item.shortLabel}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sleek Left Navigation Rail */}
      <aside
        aria-label="Desktop navigation"
        className="fixed top-0 bottom-0 left-0 z-40 hidden w-20 flex-col items-center justify-between border-r border-white/[0.08] bg-[#09090B]/92 py-6 backdrop-blur-xl md:flex"
      >
        <Link
          href="/"
          onClickCapture={stopGlobalPlayback}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D4AF37]/40 bg-[#121215] font-serif text-sm font-bold text-[#D4AF37] transition hover:border-[#D4AF37] hover:shadow-[0_0_18px_rgba(212,175,55,0.28)]"
          title="KinoStream Home"
        >
          K
        </Link>

        <nav className="flex flex-col items-center gap-2.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClickCapture={stopGlobalPlayback}
                title={item.label}
                className={cn(
                  'group relative flex h-12 w-12 flex-col items-center justify-center rounded-2xl transition-all',
                  active
                    ? 'border border-[#D4AF37]/35 bg-[#D4AF37]/12 text-[#D4AF37]'
                    : 'text-[#71717A] hover:bg-white/[0.04] hover:text-[#FAFAFA]'
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.75} />
                <span className="mt-0.5 text-[9px] font-medium tracking-tight">
                  {item.shortLabel}
                </span>
                {active && (
                  <span className="absolute -left-[1px] h-5 w-[3px] rounded-r-full bg-[#D4AF37]" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="text-[10px] font-medium tracking-widest text-[#71717A]">
          PWA
        </div>
      </aside>
    </>
  );
}
