'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { stopGlobalPlayback } from '@/lib/playback-cleanup';
import { STREAMING_PLATFORMS, type StreamingPlatformSlug } from '@/lib/streaming-platforms';
import { cn } from '@/lib/utils';
import { useMediaDetails } from '@/components/MediaDetails';

interface StreamingPlatformsRowProps {
  activeSlug?: StreamingPlatformSlug | string;
  compact?: boolean;
  className?: string;
}

const PLATFORM_ORDER: StreamingPlatformSlug[] = [
  'netflix', 'disney-plus', 'max', 'hulu', 'prime-video', 'paramount-plus', 'peacock', 'apple-tv-plus',
];
const DISPLAY_PLATFORMS = [...STREAMING_PLATFORMS].sort(
  (a, b) => PLATFORM_ORDER.indexOf(a.slug) - PLATFORM_ORDER.indexOf(b.slug)
);

export function StreamingPlatformsRow({ activeSlug, compact = false, className }: StreamingPlatformsRowProps) {
  const track = useRef<HTMLDivElement>(null);
  const { openPlatform } = useMediaDetails();
  const scroll = (direction: number) => {
    if (!track.current) return;
    track.current.scrollBy({
      left: direction * track.current.clientWidth * 0.85,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  };

  return (
    <section className={cn('kino-platforms', compact && 'kino-platforms-compact', className)} aria-label="Browse by platform">
      <div className="kino-platform-heading">
        <h2 className="kino-section-heading">Browse by Platform</h2>
        <div className="kino-platform-navigation">
          <button type="button" aria-label="Previous platforms" onClick={() => scroll(-1)}><ChevronLeft size={16} /></button>
          <button type="button" aria-label="More platforms" onClick={() => scroll(1)}><ChevronRight size={16} /></button>
        </div>
      </div>
      <div ref={track} className="kino-platform-track scrollbar-hide">
        {DISPLAY_PLATFORMS.map((platform) => (
          <Link
            key={platform.slug}
            href={`/platforms/${platform.slug}`}
            onClickCapture={stopGlobalPlayback}
            onClick={(event) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
              event.preventDefault();
              openPlatform(platform.slug);
            }}
            aria-haspopup="dialog"
            aria-current={activeSlug === platform.slug ? 'page' : undefined}
            aria-label={`Browse ${platform.name}`}
            className={cn('kino-platform-tile', `kino-platform-${platform.slug}`, activeSlug === platform.slug && 'is-active')}
          ><span className="kino-platform-wordmark">{platform.name}</span></Link>
        ))}
      </div>
    </section>
  );
}
