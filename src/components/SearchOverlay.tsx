'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Film, Loader2, Radio, Search, Trophy, X } from 'lucide-react';
import { useKino } from '@/components/KinoProvider';
import { usePresence } from '@/lib/use-presence';
import type { MediaItem } from '@/types/media';

type SearchFilter = 'all' | 'movie' | 'series' | 'live';
const FILTERS: { value: SearchFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'series', label: 'TV shows' },
  { value: 'live', label: 'Live TV & Sports' },
];
const SEARCH_WORDS = ['movies', 'TV shows', 'hidden gems', 'your next binge', 'something great'];

export function SearchOverlay() {
  const { isSearchOpen, closeSearch, channels } = useKino();
  const { present, exiting } = usePresence(isSearchOpen);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [word, setWord] = useState(0);
  const [vodResults, setVodResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(closeSearch);
  closeRef.current = closeSearch;
  const openRef = useRef(isSearchOpen);
  openRef.current = isSearchOpen;

  useEffect(() => {
    if (isSearchOpen) {
      const focusFrame = window.requestAnimationFrame(() => inputRef.current?.focus());
      return () => window.cancelAnimationFrame(focusFrame);
    }
  }, [isSearchOpen]);

  useEffect(() => {
    if (!present) {
      setQuery('');
      setVodResults([]);
      setFilter('all');
    }
  }, [present]);

  useEffect(() => {
    if (!present) return;
    // Capture once per visible session, retaining the trigger through a rapid reopen.
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== 'Tab') return;
      if (!openRef.current) {
        event.preventDefault();
        return;
      }
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),[tabindex="0"]'
      ) || []).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) return;
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      if (openerRef.current?.isConnected) openerRef.current.focus({ preventScroll: true });
    };
  }, [present]);

  useEffect(() => {
    if (!isSearchOpen || query || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setWord((previous) => (previous + 1) % SEARCH_WORDS.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [isSearchOpen, query]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!isSearchOpen || !trimmed) {
      setVodResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/tmdb?action=search&query=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { results?: MediaItem[] };
          setVodResults(Array.isArray(data.results) ? data.results.slice(0, 12) : []);
        } else if (!cancelled) setVodResults([]);
      } catch {
        if (!cancelled) setVodResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 260);
    return () => { cancelled = true; window.clearTimeout(timer); controller.abort(); };
  }, [query, isSearchOpen]);

  if (!present) return null;
  const q = query.trim().toLowerCase();
  const matchedChannels = q ? channels.filter((channel) =>
    channel.name.toLowerCase().includes(q) || channel.group.toLowerCase().includes(q) || channel.league?.toLowerCase().includes(q)
  ).slice(0, 8) : channels.slice(0, 6);
  const sportsMatches = matchedChannels.filter((channel) => channel.category === 'sports');
  const liveMatches = matchedChannels.filter((channel) => channel.category === 'live');
  const showChannels = filter === 'all' || filter === 'live';
  const filteredVod = vodResults.filter((item) => filter === 'all' || filter === item.type);

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Search KinoStream" aria-hidden={exiting || undefined} className={`kino-search${isSearchOpen ? ' is-open' : ' is-closing'}`}>
      <button type="button" onClick={closeSearch} aria-label="Close search" inert={exiting} className="kino-search-close"><X size={20} /></button>
      <div inert={exiting} className="kino-search-content">
        <div className="kino-search-intro">
          <h2>Search <span className="kino-search-word" key={word} aria-hidden="true">{Array.from(SEARCH_WORDS[word]).map((letter, index) => <span className="kino-search-letter" key={`${word}-${index}`} style={{ animationDelay: `${index * 16}ms` }}>{letter}</span>)}</span><span className="sr-only">KinoStream</span></h2>
          <div className="kino-search-field">
            <Search size={17} aria-hidden="true" />
            <input ref={inputRef} type="search" aria-label="Search movies, shows, live TV and sports" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find movies, shows, and more" autoComplete="off" />
            {loading ? <Loader2 size={16} className="animate-spin" aria-label="Searching" /> : <kbd>ESC</kbd>}
          </div>
          <div className="kino-search-filters" aria-label="Search category">
            {FILTERS.map((option) => (
              <button key={option.value} type="button" aria-pressed={filter === option.value} className={filter === option.value ? 'is-active' : ''} onClick={() => setFilter(option.value)}>{option.label}</button>
            ))}
          </div>
        </div>

        <div key={filter} className="kino-search-results" aria-busy={loading}>
          {showChannels && sportsMatches.length > 0 && (
            <section>
              <h3 className="kino-search-section-title"><Trophy size={15} />{q ? 'Live sports' : 'Featured sports channels'}</h3>
              <div className="kino-search-channel-grid">
                {sportsMatches.map((channel) => (
                  <Link key={channel.id} href={`/watch/sports/${encodeURIComponent(channel.id)}`} onClick={closeSearch} className="kino-search-channel">
                    <span><strong>{channel.name}</strong><small>{channel.league || channel.group}</small></span>
                    <span className="kino-search-live"><span />LIVE</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {showChannels && liveMatches.length > 0 && (
            <section>
              <h3 className="kino-search-section-title"><Radio size={15} />{q ? 'Live TV channels' : 'Popular live broadcasts'}</h3>
              <div className="kino-search-channel-grid">
                {liveMatches.map((channel) => (
                  <Link key={channel.id} href={`/watch/live/${encodeURIComponent(channel.id)}`} onClick={closeSearch} className="kino-search-channel">
                    <span><strong>{channel.name}</strong><small>{channel.group}</small></span><span className="kino-search-quality">{channel.quality || 'LIVE'}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {q && filter !== 'live' && (
            <section>
              <h3 className="kino-search-section-title"><Film size={15} />{filter === 'movie' ? 'Movies' : filter === 'series' ? 'TV shows' : 'Movies & TV shows'}</h3>
              {filteredVod.length > 0 ? (
                <div className="kino-search-posters">
                  {filteredVod.map((item) => (
                    <Link key={`${item.type}-${item.id}`} href={`/watch/${item.type}/${encodeURIComponent(item.id)}`} onClick={closeSearch} className="kino-search-result">
                      <div className="kino-search-result-artwork">
                        {item.posterPath ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.posterPath} alt="" loading="lazy" />
                        ) : <Film size={28} />}
                      </div>
                      <strong>{item.title}</strong><small>{[item.year, item.type === 'series' ? 'Series' : 'Movie'].filter(Boolean).join(' · ')}</small>
                    </Link>
                  ))}
                </div>
              ) : loading ? (
                <div className="kino-search-posters" aria-label="Loading search results">{Array.from({ length: 6 }, (_, index) => <div key={index} className="kino-search-skeleton" />)}</div>
              ) : <p className="kino-search-empty">No {filter === 'all' ? 'movies or shows' : filter === 'movie' ? 'movies' : 'shows'} matched “{query}”.</p>}
            </section>
          )}
          {!q && (filter === 'movie' || filter === 'series') && <p className="kino-search-empty">Search for a title to explore {filter === 'movie' ? 'movies' : 'TV shows'}.</p>}
          {q && showChannels && matchedChannels.length === 0 && filter === 'live' && <p className="kino-search-empty">No live channels matched “{query}”.</p>}
        </div>
      </div>
    </div>
  );
}
