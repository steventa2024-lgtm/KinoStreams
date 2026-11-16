'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MediaRowProps {
  title: string;
  subtitle?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  children: React.ReactNode;
}

export function MediaRow({
  title,
  subtitle,
  viewAllHref,
  viewAllLabel = 'View All',
  children,
}: MediaRowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollByAmount = (direction: 'left' | 'right') => {
    const el = scrollerRef.current;
    if (!el) return;
    const offset = Math.max(el.clientWidth * 0.78, 280);
    el.scrollBy({
      left: direction === 'left' ? -offset : offset,
      behavior: 'smooth',
    });
  };

  return (
    <section className="relative py-4 md:py-6">
      <div className="mx-auto mb-3.5 flex max-w-[1440px] items-end justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <div>
          <h2 className="font-serif text-xl font-medium tracking-tight text-[#FAFAFA] md:text-2xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-[#71717A] md:text-sm">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 md:flex">
            <button
              type="button"
              onClick={() => scrollByAmount('left')}
              aria-label={`Scroll ${title} left`}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-[#121215] text-[#A1A1AA] transition hover:border-[#D4AF37]/40 hover:text-[#FAFAFA]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollByAmount('right')}
              aria-label={`Scroll ${title} right`}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-[#121215] text-[#A1A1AA] transition hover:border-[#D4AF37]/40 hover:text-[#FAFAFA]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-[#E2C275] transition hover:border-[#D4AF37]/40 hover:bg-[#D4AF37]/10"
            >
              {viewAllLabel}
            </Link>
          )}
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="scrollbar-hide mx-auto flex max-w-[1440px] gap-3.5 overflow-x-auto px-4 snap-x snap-mandatory sm:px-6 md:gap-5 lg:px-10"
      >
        {children}
      </div>
    </section>
  );
}
