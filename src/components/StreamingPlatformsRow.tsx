'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Sparkles } from 'lucide-react';
import { stopGlobalPlayback } from '@/lib/playback-cleanup';
import {
  STREAMING_PLATFORMS,
  type StreamingPlatformSlug,
} from '@/lib/streaming-platforms';
import { cn } from '@/lib/utils';

interface StreamingPlatformsRowProps {
  activeSlug?: StreamingPlatformSlug | string;
  compact?: boolean;
  className?: string;
}

export function StreamingPlatformsRow({
  activeSlug,
  compact = false,
  className,
}: StreamingPlatformsRowProps) {
  return (
    <section className={cn(compact ? 'mb-8' : 'mb-10', className)}>
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <h2
              className={cn(
                'font-semibold tracking-tight text-zinc-100',
                compact ? 'text-base sm:text-lg' : 'text-xl sm:text-2xl'
              )}
            >
              Browse by Streaming App
            </h2>
          </div>
          {!compact && (
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Curated US flatrate catalogs across Netflix, Disney+, Prime Video, Paramount+, Peacock &amp; more
            </p>
          )}
        </div>

        <Link
          href="/platforms/netflix"
          onClickCapture={stopGlobalPlayback}
          className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300 transition shrink-0"
        >
          <span>Explore Hubs</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none sm:grid sm:grid-cols-4 lg:grid-cols-8 sm:overflow-visible">
        {STREAMING_PLATFORMS.map((platform) => {
          const isActive = activeSlug === platform.slug;

          return (
            <Link
              key={platform.slug}
              href={`/platforms/${platform.slug}`}
              onClickCapture={stopGlobalPlayback}
              className={cn(
                'group relative flex flex-col justify-between rounded-xl border bg-[#121215] transition-all duration-200 overflow-hidden shrink-0',
                compact ? 'min-w-[136px] sm:min-w-0 p-3' : 'min-w-[152px] sm:min-w-0 p-3.5 sm:p-4',
                isActive
                  ? 'border-amber-500/80 bg-amber-500/10 shadow-[0_0_24px_-8px_rgba(245,158,11,0.5)]'
                  : 'border-white/10 hover:border-amber-500/50 hover:bg-[#16161b] hover:-translate-y-0.5'
              )}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-20 group-hover:opacity-35 transition-opacity"
                style={{
                  background: `radial-gradient(circle at 88% 14%, ${platform.accentColor}, transparent 62%)`,
                }}
              />

              <div className="relative flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'inline-flex items-center justify-center rounded-lg border font-bold tracking-wider uppercase',
                    compact ? 'h-7 px-2 text-[10px]' : 'h-8 px-2.5 text-[11px]',
                    isActive
                      ? 'border-amber-400/60 bg-amber-500/20 text-amber-300'
                      : 'border-white/15 bg-black/50 text-zinc-100 group-hover:border-amber-500/40'
                  )}
                  style={
                    isActive
                      ? undefined
                      : { boxShadow: `inset 0 0 0 1px ${platform.accentColor}26` }
                  }
                >
                  {platform.monogram}
                </span>

                <ChevronRight
                  className={cn(
                    'h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5',
                    isActive ? 'text-amber-400' : 'text-zinc-500 group-hover:text-amber-400'
                  )}
                />
              </div>

              <div className={cn('relative', compact ? 'mt-2.5' : 'mt-3.5')}>
                <p
                  className={cn(
                    'font-semibold tracking-tight truncate',
                    compact ? 'text-xs sm:text-sm' : 'text-sm',
                    isActive ? 'text-amber-300' : 'text-zinc-100 group-hover:text-white'
                  )}
                >
                  {platform.name}
                </p>
                {!compact && (
                  <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                    Movies &amp; Series
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
