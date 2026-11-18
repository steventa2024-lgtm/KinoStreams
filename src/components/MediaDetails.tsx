'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check, ChevronDown, Film, Loader2, Play, Plus, Star, X } from 'lucide-react';
import { useKino } from '@/components/KinoProvider';
import type { EpisodeItem, MediaItem } from '@/types/media';

type DetailsContextValue = { openDetails: (item: MediaItem) => void };
const DetailsContext = createContext<DetailsContextValue | null>(null);

/** Presentation layer only: uses the existing catalog, history and watch routes. */
export function MediaDetailsProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const pathname = usePathname();
  const previousPath = useRef(pathname);

  const openDetails = useCallback((item: MediaItem) => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelected(item);
  }, []);

  const close = useCallback(() => {
    setSelected(null);
    requestAnimationFrame(() => {
      if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true });
    });
  }, []);

  useEffect(() => {
    if (previousPath.current !== pathname) {
      setSelected(null);
      previousPath.current = pathname;
    }
  }, [pathname]);

  return (
    <DetailsContext.Provider value={{ openDetails }}>
      {children}
      {selected && (
        <MediaDetailsDialog
          key={`${selected.type}:${selected.id}`}
          initialItem={selected}
          onClose={close}
          onSelect={setSelected}
        />
      )}
    </DetailsContext.Provider>
  );
}

export function useMediaDetails() {
  const context = useContext(DetailsContext);
  if (!context) throw new Error('useMediaDetails must be used inside MediaDetailsProvider');
  return context;
}

function MediaDetailsDialog({ initialItem, onClose, onSelect }: {
  initialItem: MediaItem;
  onClose: () => void;
  onSelect: (item: MediaItem) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [closing, setClosing] = useState(false);
  const [item, setItem] = useState(initialItem);
  const [recommendations, setRecommendations] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [season, setSeason] = useState(initialItem.seasons?.[0]?.seasonNumber || 1);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const { isSaved, toggleSaved, watchHistory } = useKino();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const requestClose = useCallback(() => {
    if (closeTimer.current) return;
    setClosing(true);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    closeTimer.current = setTimeout(onClose, reduced ? 0 : 220);
  }, [onClose]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      action: 'details',
      mediaType: initialItem.type === 'series' ? 'tv' : 'movie',
      id: initialItem.id,
    });
    async function load() {
      try {
        const response = await fetch(`/api/tmdb?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Details unavailable');
        const data = await response.json() as { item?: MediaItem; recommendations?: MediaItem[] };
        if (!data.item) throw new Error('Details unavailable');
        if (!controller.signal.aborted) {
          if (data.item) setItem({ ...initialItem, ...data.item, id: initialItem.id, type: initialItem.type });
          setRecommendations(data.recommendations || []);
        }
      } catch {
        if (!controller.signal.aborted) setUnavailable(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [initialItem]);

  useEffect(() => {
    if (item.type !== 'series') return;
    const controller = new AbortController();
    setEpisodesLoading(true);
    setEpisodes([]);
    const params = new URLSearchParams({ action: 'season', id: item.id, seasonNumber: String(season) });
    async function load() {
      try {
        const response = await fetch(`/api/tmdb?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Episodes unavailable');
        const data = await response.json() as { episodes?: EpisodeItem[] };
        if (!Array.isArray(data.episodes)) throw new Error('Episodes unavailable');
        if (!controller.signal.aborted) setEpisodes(data.episodes || []);
      } catch {
        // The existing watch page remains available if extra details cannot load.
      } finally {
        if (!controller.signal.aborted) setEpisodesLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [item.id, item.tmdbId, item.type, season]);

  const saved = isSaved(item.id, item.type);
  const history = watchHistory.find((entry) => entry.id === item.id && entry.type === item.type);
  const resumeQuery = item.type === 'series' && history?.season && history?.episode
    ? `?season=${history.season}&episode=${history.episode}` : '';
  const watchHref = `/watch/${item.type}/${encodeURIComponent(item.id)}${resumeQuery}`;
  const backdrop = item.backdropPath || item.posterPath;

  return (
    <dialog
      ref={dialogRef}
      className={`kino-details${closing ? ' is-closing' : ''}`}
      aria-labelledby="kino-details-title"
      onCancel={(event) => { event.preventDefault(); requestClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) requestClose(); }}
      onKeyDown={(event) => {
        // Keep the global search shortcut from opening a second focus trap behind this dialog.
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <article className="kino-details__sheet">
        {backdrop && <div className="kino-details__ambient" style={{ backgroundImage: `url("${backdrop}")` }} aria-hidden="true" />}
        <button type="button" className="kino-details__close" onClick={requestClose} aria-label="Close details" autoFocus>
          <X size={19} />
        </button>
        <div className="kino-details__hero">
          {backdrop ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={backdrop} alt="" className="kino-details__backdrop" />
          ) : <Film className="kino-details__fallback" size={60} />}
          <div className="kino-details__hero-copy">
            <h2 id="kino-details-title">{item.title}</h2>
            <div className="kino-details__actions">
              <Link href={watchHref} className="kino-button kino-button--play" onClick={onClose}>
                <Play size={15} fill="currentColor" />
                {history ? `Continue${history.season && history.episode ? ` · S${history.season} E${history.episode}` : ''}` : 'Play'}
              </Link>
              <button
                type="button"
                className="kino-button kino-button--round"
                aria-label={saved ? `Remove ${item.title} from watchlist` : `Add ${item.title} to watchlist`}
                aria-pressed={saved}
                onClick={() => toggleSaved({ id: item.id, type: item.type, title: item.title, poster: item.posterPath, backdrop: item.backdropPath, year: item.year, rating: item.rating, subtitle: item.genres?.slice(0, 2).join(' · ') })}
              >
                {saved ? <Check size={17} /> : <Plus size={17} />}
              </button>
              <Link href={watchHref} className="kino-details__full" onClick={onClose}>Open full page</Link>
            </div>
          </div>
        </div>
        <div className="kino-details__body">
          <div className="kino-details__summary">
            <div>
              <div className="kino-details__metadata">
                {!!item.rating && <span className="kino-details__rating"><Star size={12} fill="currentColor" /> {item.rating.toFixed(1)}</span>}
                {item.year && <span>{item.year}</span>}
                {item.seasonsCount ? <span>{item.seasonsCount} season{item.seasonsCount === 1 ? '' : 's'}</span> : item.runtime ? <span>{item.runtime} min</span> : null}
                {item.quality && <span className="kino-details__quality">{item.quality}</span>}
              </div>
              <p>{item.overview}</p>
              {loading && <span className="kino-details__status" role="status"><Loader2 size={12} className="animate-spin" /> Loading details</span>}
              {unavailable && <span className="kino-details__status">Additional details are unavailable. You can still open this title.</span>}
            </div>
            <div className="kino-details__credits">
              {!!item.genres?.length && <p><span>Genres</span>{item.genres.join(', ')}</p>}
              {!!item.cast?.length && <p><span>Starring</span>{item.cast.slice(0, 4).map((person) => person.name).join(', ')}</p>}
              {!!item.cast?.length && <div className="kino-details__faces" aria-hidden="true">
                {item.cast.filter((person) => person.profilePath).slice(0, 6).map((person) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={person.id} src={person.profilePath} alt="" loading="lazy" />
                ))}
              </div>}
            </div>
          </div>

          {item.type === 'series' && (
            <section className="kino-details__section" aria-label="Episodes">
              <div className="kino-details__section-heading">
                <h3>Episodes</h3>
                {!!item.seasons?.length && <label className="kino-details__season">
                  <span className="sr-only">Season</span>
                  <select value={season} onChange={(event) => setSeason(Number(event.target.value))}>
                    {item.seasons.map((entry) => <option key={entry.seasonNumber} value={entry.seasonNumber}>{entry.name || `Season ${entry.seasonNumber}`}</option>)}
                  </select>
                  <ChevronDown size={12} />
                </label>}
              </div>
              {episodesLoading ? <div className="kino-details__loading" role="status"><Loader2 size={18} className="animate-spin" /><span>Loading episodes</span></div> : episodes.length ? (
                <div className="kino-details__episodes" tabIndex={0} aria-label="Scroll episodes">
                  {episodes.map((episode) => {
                    const watched = history?.season === season && history.episode === episode.episodeNumber;
                    return <article
                      key={episode.id}
                      className="kino-episode"
                    >
                      <div className="kino-episode__image">
                        {(episode.stillPath || backdrop) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={episode.stillPath || backdrop} alt="" loading="lazy" />
                        )}
                        {episode.runtime && <span className="kino-episode__runtime">{episode.runtime} min</span>}
                        {watched && <div className="kino-episode__progress" style={{ width: `${Math.min(100, Math.max(0, history.progress))}%` }} />}
                      </div>
                      <h4>{episode.episodeNumber}. {episode.name}</h4>
                      <p>{episode.overview}</p>
                    </article>;
                  })}
                </div>
              ) : <p className="kino-details__status">Episode details are available from the full title page.</p>}
            </section>
          )}

          {!!recommendations.length && <section className="kino-details__section">
            <div className="kino-details__section-heading"><h3>You might also like</h3></div>
            <div className="kino-details__related">
              {recommendations.slice(0, 9).map((recommendation) => <button
                type="button"
                key={`${recommendation.type}:${recommendation.id}`}
                onClick={() => onSelect(recommendation)}
                className="kino-details__recommendation"
                aria-label={`More about ${recommendation.title}`}
              >
                {recommendation.posterPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={recommendation.posterPath} alt={recommendation.title} loading="lazy" />
                ) : <span>{recommendation.title}</span>}
              </button>)}
            </div>
          </section>}
        </div>
      </article>
    </dialog>
  );
}
