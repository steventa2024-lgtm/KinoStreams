'use client';

import React from 'react';
import Link from 'next/link';
import { siteConfig } from '@/config/site';

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#09090B] py-6">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-2 px-4 text-center sm:flex-row sm:px-6 lg:px-10">
        <p className="text-xs tracking-widest text-zinc-500 uppercase">
          {siteConfig.wordmark} &bull;{' '}
          <Link
            href={siteConfig.creatorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-[#D4AF37]"
          >
            by {siteConfig.creator}
          </Link>
        </p>

        <p className="text-[11px] tracking-wider text-zinc-600">
          Open-Source Cinematic Streaming PWA
        </p>
      </div>
    </footer>
  );
}
