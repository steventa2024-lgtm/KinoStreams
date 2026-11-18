'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MediaRowProps {
  title: string;
  subtitle?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  children: React.ReactNode;
}

export function MediaRow({ title, subtitle, viewAllHref, viewAllLabel = 'View all', children }: MediaRowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: false });
  const id = useId();

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const update = () => setCanScroll({
      left: scroller.scrollLeft > 4,
      right: scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft > 4,
    });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    scroller.addEventListener('scroll', update, { passive: true });
    return () => { observer.disconnect(); scroller.removeEventListener('scroll', update); };
  }, [children]);

  const scrollByAmount = (direction: 'left' | 'right') => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const offset = Math.max(scroller.clientWidth * 0.82, 240);
    scroller.scrollBy({
      left: direction === 'left' ? -offset : offset,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  };

  return (
    <section className="kino-media-row" aria-labelledby={`${id}-heading`}>
      <div className="kino-row-heading">
        <div>
          <h2 id={`${id}-heading`} className="kino-section-heading">{title}</h2>
          {subtitle && <p className="kino-row-subtitle">{subtitle}</p>}
        </div>
        {viewAllHref && (
          <Link href={viewAllHref} className="kino-row-view-all">
            {viewAllLabel}<ChevronRight size={13} aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="kino-row-track-wrap">
        <div
          ref={scrollerRef}
          id={`${id}-track`}
          className="kino-row-track scrollbar-hide"
          role="region"
          aria-label={title}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
              event.preventDefault();
              scrollByAmount(event.key === 'ArrowRight' ? 'right' : 'left');
            }
          }}
        >{children}</div>
        <button type="button" aria-label={`Scroll ${title} left`} aria-controls={`${id}-track`} className="kino-rail-arrow kino-rail-arrow-left" disabled={!canScroll.left} onClick={() => scrollByAmount('left')}>
          <ChevronLeft size={19} aria-hidden="true" />
        </button>
        <button type="button" aria-label={`Scroll ${title} right`} aria-controls={`${id}-track`} className="kino-rail-arrow kino-rail-arrow-right" disabled={!canScroll.right} onClick={() => scrollByAmount('right')}>
          <ChevronRight size={19} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
