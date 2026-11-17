export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function buildStreamProxyUrl(
  targetUrl: string,
  options?: { referrer?: string; userAgent?: string }
): string {
  const params = new URLSearchParams();
  params.set('url', targetUrl);
  if (options?.referrer) {
    params.set('referer', options.referrer);
  }
  if (options?.userAgent) {
    params.set('ua', options.userAgent);
  }
  return `/api/stream?${params.toString()}`;
}

const CORS_RESTRICTED_HLS_HOSTS = [
  'jmp2.uk',
  'pluto.tv',
  'd4whmvwm0rdvi.cloudfront.net',
  'd368vp0qqzvkid.cloudfront.net',
  'aegis-cloudfront-1.tubi.video',
  'nhl-firetv.amagi.tv',
];

/**
 * Returns true when an HLS/media stream must flow through `/api/stream` to avoid
 * HTTPS mixed-content blocks or upstream CDNs missing CORS `Access-Control-Allow-Origin`.
 */
export function shouldProxyStreamUrl(
  rawUrl?: string | null,
  explicitProxy?: boolean
): boolean {
  if (explicitProxy) return true;
  if (!rawUrl) return false;

  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    rawUrl.startsWith('http://')
  ) {
    return true;
  }

  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return CORS_RESTRICTED_HLS_HOSTS.some(
      (restricted) => host === restricted || host.endsWith(`.${restricted}`)
    );
  } catch {
    return false;
  }
}

export function formatDuration(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatClockTime(isoString?: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function calculateEpgProgress(startIso?: string, endIso?: string): number {
  if (!startIso || !endIso) return 0;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const now = Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

export function getInitials(name: string): string {
  const parts = name
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'KS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function slugifyId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/**
 * Sanitize third-party media/logo/icon URLs from M3U, XMLTV, or API feeds.
 * Allows only http:, https:, safe same-origin relative paths (/...), or raster image data URIs.
 * Blocks javascript:, vbscript:, data:text/html, and protocol-relative // URLs.
 */
export function sanitizeMediaUrl(raw?: string | null): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) return undefined;

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Append explicit autoplay (and optional mute & audio language) parameters to any
 * third-party embed URL without stripping existing theme/player parameters.
 */
export function withEmbedAutoplayParams(
  rawUrl: string,
  options?: { muted?: boolean; lang?: string }
): string {
  const cleanLang = options?.lang?.trim().toLowerCase();
  const hasExplicitLang = Boolean(cleanLang && cleanLang !== 'original');

  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has('autoplay')) {
      url.searchParams.set('autoplay', '1');
    }
    if (!url.searchParams.has('autoPlay')) {
      url.searchParams.set('autoPlay', 'true');
    }
    if (!url.searchParams.has('playsinline')) {
      url.searchParams.set('playsinline', '1');
    }
    if (options?.muted) {
      url.searchParams.set('mute', '1');
      url.searchParams.set('muted', 'true');
    } else if (url.searchParams.has('mute') || url.searchParams.has('muted')) {
      url.searchParams.set('mute', '0');
      url.searchParams.set('muted', 'false');
    }
    if (hasExplicitLang && cleanLang) {
      url.searchParams.set('lang', cleanLang);
      url.searchParams.set('ds_lang', cleanLang);
      url.searchParams.set('audio', cleanLang);
    }
    return url.toString();
  } catch {
    const sep = rawUrl.includes('?') ? '&' : '?';
    const muteParams = options?.muted ? '&mute=1&muted=true' : '';
    const langParams =
      hasExplicitLang && cleanLang
        ? `&lang=${encodeURIComponent(cleanLang)}&ds_lang=${encodeURIComponent(cleanLang)}&audio=${encodeURIComponent(cleanLang)}`
        : '';
    return `${rawUrl}${sep}autoplay=1&autoPlay=true&playsinline=1${muteParams}${langParams}`;
  }
}
