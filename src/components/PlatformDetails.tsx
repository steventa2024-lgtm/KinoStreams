'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronLeft, ChevronRight, Film, Loader2, Play, X } from 'lucide-react';
import { getStreamingPlatform } from '@/lib/streaming-platforms';
import { stopGlobalPlayback } from '@/lib/playback-cleanup';
import type { MediaItem } from '@/types/media';

interface PlatformApiItem extends MediaItem {
  media_type?: 'movie' | 'tv';
}

interface PlatformRows {
  trending: PlatformApiItem[];
  topMovies: PlatformApiItem[];
  hitSeries: PlatformApiItem[];
}

interface PlatformDetailsProps {
  slug: string;
  onClose: () => void;
  onSelect: (item: MediaItem) => void;
}

const EMPTY_ROWS: PlatformRows = { trending: [], topMovies: [], hitSeries: [] };

// Match the existing platform hub's watch routes, including its TV alias.
function watchHref(item: PlatformApiItem): string {
  return item.media_type === 'tv' || item.type === 'series'
    ? `/watch/tv/${item.id}`
    : `/watch/movie/${item.id}`;
}

/** A presentation of the existing provider catalog; the parent swaps dialogs on selection. */
export function PlatformDetailsDialog({ slug, onClose, onSelect }: PlatformDetailsProps) {
  const platform = getStreamingPlatform(slug);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacks = useRef({ onClose, onSelect });
  callbacks.current = { onClose, onSelect };
  const [closing, setClosing] = useState(false);
  const [rows, setRows] = useState<PlatformRows>(EMPTY_ROWS);
  const [items, setItems] = useState<PlatformApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (closingTimer.current) clearTimeout(closingTimer.current);
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const dismiss = useCallback((selection?: MediaItem) => {
    if (closingTimer.current) return;
    setClosing(true);
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200;
    closingTimer.current = setTimeout(() => {
      if (selection) callbacks.current.onSelect(selection);
      else callbacks.current.onClose();
    }, duration);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    setRows(EMPTY_ROWS);
    setItems([]);
    if (!platform) {
      setLoading(false);
      setFailed(true);
      return () => controller.abort();
    }
    async function loadCatalog() {
      try {
        const response = await fetch(`/api/platforms/${platform!.slug}?type=all&sort=popularity.desc&page=1`, { signal: controller.signal });
        if (!response.ok) throw new Error('Provider catalog unavailable');
        const data = await response.json() as { items?: PlatformApiItem[]; rows?: Partial<PlatformRows> };
        const incoming = Array.isArray(data.items) ? data.items : [];
        if (controller.signal.aborted) return;
        setItems(incoming);
        setRows({
          trending: Array.isArray(data.rows?.trending) ? data.rows.trending : incoming,
          topMovies: Array.isArray(data.rows?.topMovies) ? data.rows.topMovies : incoming.filter((item) => item.type === 'movie'),
          hitSeries: Array.isArray(data.rows?.hitSeries) ? data.rows.hitSeries : incoming.filter((item) => item.type === 'series' || item.media_type === 'tv'),
        });
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadCatalog();
    return () => controller.abort();
  }, [platform]);

  const collage = useMemo(() => {
    const seen = new Set<string>();
    return [...rows.trending, ...rows.topMovies, ...rows.hitSeries, ...items].filter((item) => {
      const key = `${item.type}:${item.id}`;
      if (!item.posterPath || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 18);
  }, [items, rows]);
  const ambient = collage.find((item) => item.backdropPath)?.backdropPath || collage[0]?.posterPath;
  const hasTitles = rows.trending.length + rows.topMovies.length + rows.hitSeries.length > 0;
  const name = platform?.name || 'Platform';

  return (
    <dialog
      ref={dialogRef}
      className={`kino-platform-dialog${closing ? ' is-closing' : ''}`}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); dismiss(); }}
      onClick={(event) => { if (event.target === event.currentTarget) dismiss(); }}
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <article className="kino-platform-dialog__sheet">
        {ambient && <div className="kino-platform-dialog__ambient" aria-hidden="true" style={{ backgroundImage: `url("${ambient}")` }} />}
        <button type="button" className="kino-platform-dialog__close" aria-label={`Close ${name} catalog`} onClick={() => dismiss()} autoFocus><X size={18} /></button>
        <header className="kino-platform-dialog__header">
          <div className="kino-platform-dialog__collage" aria-hidden="true">
            {collage.length > 0 ? collage.map((item) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${item.type}:${item.id}`} src={item.posterPath} alt="" />
            )) : Array.from({ length: 18 }, (_, index) => <span key={index} />)}
          </div>
          <div className="kino-platform-dialog__identity">
            <h2 id={titleId} className={`kino-platform-dialog__wordmark kino-platform-dialog__wordmark--${platform?.slug || 'default'}`}>{name}</h2>
            {platform && <Link href={`/platforms/${platform.slug}`} onClickCapture={stopGlobalPlayback} onClick={onClose} className="kino-platform-dialog__catalog-link">Full catalog <ArrowUpRight size={13} aria-hidden="true" /></Link>}
          </div>
        </header>
        <div className="kino-platform-dialog__body" aria-busy={loading}>
          {loading ? (
            <div className="kino-platform-dialog__loading" role="status">
              <span><Loader2 size={13} className="animate-spin" />Loading {name}</span>
              <div className="kino-platform-dialog__skeletons" aria-hidden="true"><span /><span /><span /></div>
            </div>
          ) : failed ? (
            <div className="kino-platform-dialog__empty" role="status">
              <Film size={27} aria-hidden="true" /><p>{platform ? `${name} titles could not be loaded right now.` : 'This platform is unavailable.'}</p>
              {platform && <Link href={`/platforms/${platform.slug}`} onClickCapture={stopGlobalPlayback} onClick={onClose}>Open the full catalog <ArrowUpRight size={13} /></Link>}
            </div>
          ) : !hasTitles ? (
            <div className="kino-platform-dialog__empty" role="status"><Film size={27} aria-hidden="true" /><p>No titles are available in this catalog right now.</p></div>
          ) : (
            <>
              {rows.trending.length > 0 && <PlatformRow title={`Trending on ${name}`} items={rows.trending} onSelect={dismiss} onNavigate={onClose} />}
              {rows.topMovies.length > 0 && <PlatformRow title="Top Movies" items={rows.topMovies} onSelect={dismiss} onNavigate={onClose} />}
              {rows.hitSeries.length > 0 && <PlatformRow title="Hit Series" items={rows.hitSeries} onSelect={dismiss} onNavigate={onClose} />}
            </>
          )}
        </div>
      </article>
    </dialog>
  );
}

function PlatformRow({ title, items, onSelect, onNavigate }: {
  title: string;
  items: PlatformApiItem[];
  onSelect: (item: MediaItem) => void;
  onNavigate: () => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const id = useId();
  const scroll = (direction: number) => {
    if (!track.current) return;
    track.current.scrollBy({
      left: direction * track.current.clientWidth * 0.88,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  };
  return (
    <section className="kino-platform-dialog__row" aria-labelledby={`${id}-title`}>
      <div className="kino-platform-dialog__row-heading">
        <h3 id={`${id}-title`}>{title}</h3>
        {items.length > 3 && <div className="kino-platform-dialog__row-controls">
          <button type="button" aria-label={`Previous ${title} titles`} aria-controls={id} onClick={() => scroll(-1)}><ChevronLeft size={13} /></button>
          <button type="button" aria-label={`More ${title} titles`} aria-controls={id} onClick={() => scroll(1)}><ChevronRight size={13} /></button>
        </div>}
      </div>
      <div ref={track} id={id} className="kino-platform-dialog__track" tabIndex={0} role="region" aria-label={title} onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault(); scroll(event.key === 'ArrowLeft' ? -1 : 1);
        }
      }}>
        {items.map((item) => (
          <article className="kino-platform-dialog__poster" key={`${item.type}:${item.id}`}>
            <div className="kino-platform-dialog__poster-artwork">
              <button type="button" onClick={() => onSelect(item)} aria-label={`More information about ${item.title}`}>
                {item.posterPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.posterPath} alt="" loading="lazy" />
                ) : <span className="kino-platform-dialog__poster-fallback"><Film size={25} /><span>{item.title}</span></span>}
              </button>
              <Link href={watchHref(item)} onClick={onNavigate} className="kino-platform-dialog__play" aria-label={`Play ${item.title}`}><Play size={13} fill="currentColor" /><span>Play</span></Link>
            </div>
            <h4>{item.title}</h4>
          </article>
        ))}
      </div>
    </section>
  );
}
