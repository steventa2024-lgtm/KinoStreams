'use client';

import React from 'react';
import Link from 'next/link';
import { Play, Radio } from 'lucide-react';
import {
  calculateEpgProgress,
  formatClockTime,
  getInitials,
} from '@/lib/utils';
import type { Channel, EpgChannelSchedule } from '@/types/media';

interface ChannelCardProps {
  channel: Channel;
  schedule?: EpgChannelSchedule;
  variant?: 'sports' | 'broadcast';
  fullWidth?: boolean;
}

export function ChannelCard({
  channel,
  schedule,
  variant = 'sports',
  fullWidth = false,
}: ChannelCardProps) {
  const href = `/watch/${channel.category}/${encodeURIComponent(channel.id)}`;
  const nowProg = schedule?.now;
  const progress = calculateEpgProgress(nowProg?.start, nowProg?.end);

  if (variant === 'broadcast') {
    return (
      <Link
        href={href}
        className={`group flex flex-col justify-between rounded-lg border border-white/[0.08] bg-[#151517] p-4 transition-all duration-300 hover:border-[#e50935]/40 hover:bg-[#17171B] ${
          fullWidth ? 'w-full' : 'w-[290px] shrink-0 snap-start md:w-[340px]'
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FAFAFA] text-[#080809] shadow-[0_0_20px_rgba(229,9,53,0.25)] transition-transform duration-300 group-hover:scale-105">
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          </div>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-[#080809]">
            {channel.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={channel.logo}
                alt={channel.name}
                className="h-full w-full object-contain p-1"
                loading="lazy"
              />
            ) : (
              <span className="font-sans text-xs font-semibold tracking-wider text-[#fb5272]">
                {getInitials(channel.name)}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
                {channel.name}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#EF4444]/15 px-2 py-0.5 text-[10px] font-semibold text-[#EF4444]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#EF4444]" />
                LIVE
              </span>
            </div>
            <p className="mt-0.5 truncate text-sm font-medium text-[#FAFAFA] group-hover:text-[#e4e4e7]">
              {nowProg?.title || channel.description || `${channel.group} Broadcast`}
            </p>
          </div>
        </div>

        <div className="mt-3.5">
          <div className="flex items-center justify-between text-[11px] text-[#71717A]">
            <span className="truncate">
              {nowProg
                ? `${formatClockTime(nowProg.start)} – ${formatClockTime(nowProg.end)}`
                : channel.group}
            </span>
            {schedule?.next && (
              <span className="ml-2 truncate text-[#A1A1AA]">
                Next: {schedule.next.title}
              </span>
            )}
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#e50935] to-[#e4e4e7] transition-all duration-500"
              style={{ width: `${Math.max(progress, 12)}%` }}
            />
          </div>
        </div>
      </Link>
    );
  }

  // Sports / 16:9 Widescreen Card
  return (
    <Link
      href={href}
      className={`group block overflow-hidden rounded-lg border border-white/[0.08] bg-[#151517] transition-all duration-300 hover:border-[#e50935]/45 ${
        fullWidth ? 'w-full' : 'w-[260px] shrink-0 snap-start md:w-[320px]'
      }`}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-[#080809]">
        {channel.backdrop ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={channel.backdrop}
            alt={channel.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top_right,rgba(229,9,53,0.2),#080809_70%)]">
            {channel.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={channel.logo}
                alt={channel.name}
                className="h-14 w-28 object-contain opacity-90"
                loading="lazy"
              />
            ) : (
              <Radio className="h-10 w-10 text-[#fb5272]/60" />
            )}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#080809] via-[#080809]/25 to-transparent" />

        {/* Top-left pulsing LIVE pill */}
        <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-[#EF4444] px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-white shadow-lg">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          LIVE
        </div>

        {/* Top-right league / quality badge */}
        <div className="absolute top-3 right-3 rounded-full border border-white/15 bg-[#080809]/70 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#e4e4e7] backdrop-blur-md">
          {channel.league || channel.group}
        </div>

        {/* Bottom play indicator */}
        <div className="absolute right-3 bottom-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#e50935]/95 text-[#080809] opacity-90 shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:opacity-100">
          <Play className="ml-0.5 h-4 w-4 fill-current" />
        </div>
      </div>

      <div className="p-3.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate font-sans text-base font-medium text-[#FAFAFA] group-hover:text-[#e4e4e7]">
            {nowProg?.title || channel.name}
          </h3>
          {channel.quality && (
            <span className="shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[10px] font-medium text-[#A1A1AA]">
              {channel.quality}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-[#A1A1AA]">
          {channel.name}
          {nowProg?.category ? ` · ${nowProg.category}` : ` · ${channel.group}`}
        </p>
      </div>
    </Link>
  );
}
