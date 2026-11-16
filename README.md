# KinoStream

Open-source, mobile-first Progressive Web App (PWA) for streaming **Live TV**, **Live Sports**, **Movies**, and **TV Series** with a Cinematic Minimalist obsidian-and-champagne dark UI.

Built with **Next.js 15 (App Router)**, **TypeScript (`strict: true`)**, **Tailwind CSS**, **hls.js**, and **Lucide Icons**.

---

## Features

- **Cinematic Minimalist Design:** Deep Obsidian (`#09090B`), Elevated Surface (`#121215`), Frosted Glass overlays, Champagne Gold (`#D4AF37` / `#E2C275`) accents, `Playfair Display` serif headers, and `Inter` UI typography.
- **Custom HLS + Native Safari Video Player (`src/components/VideoPlayer.tsx`):**
  - Adaptive HLS playback via `hls.js` on Chrome/Firefox/Edge/Android and native `application/vnd.apple.mpegurl` on iOS/Safari.
  - AirPlay (`x-webkit-airplay="allow"`) and Picture-in-Picture support.
  - Quality selector, Live status indicator, Continue Watching progress tracking, and automatic CORS proxy fallback.
- **CORS & Referer HLS Stream Proxy (`/api/stream`):**
  - Rewrites `.m3u8` master/media playlists, segment URLs, and `#EXT-X-KEY` / `#EXT-X-MAP` URIs on the fly with optional `Referer` and `User-Agent` headers, plus HTTP `Range` forwarding for `.ts`/`.mp4` streams and SSRF host protection.
- **M3U8, Xtream Codes & XMLTV EPG Support (`/api/channels`, `/api/epg`):**
  - Robust `#EXTM3U` parser (`tvg-id`, `tvg-name`, `tvg-logo`, `group-title`, `#EXTVLCOPT` headers, inline pipe headers).
  - Xtream Codes live category & stream resolution.
  - XMLTV EPG parser (supports both `.xml` and `.xml.gz` feeds) for real-time Now/Next schedules.
  - Out-of-the-box curated legal Free-To-Air (FTA) channels and open-archive cinema so playback works immediately with zero configuration.
- **TMDB Catalog Proxy (`/api/tmdb`):**
  - Trending, Discover, Genre filters, Instant Search (`Cmd+K` / `Ctrl+K`), Details, Cast, Trailers, and Season/Episode pickers. Falls back gracefully to open-access cinema when `TMDB_API_KEY` is omitted.
- **Installable PWA (`src/app/manifest.ts`, `public/sw.js`):**
  - Full Web App Manifest, offline shell Service Worker, and Apple iOS standalone meta tags (`black-translucent` status bar).
- **Optional 4-Digit PIN Lock (`/api/auth/pin`):**
  - Set `KINO_PIN` in `.env.local` to protect your instance with an HMAC-SHA256 signed HTTP-only session cookie.

---

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment (optional):**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` to add your `TMDB_API_KEY`, optional `KINO_PIN`, or default `NEXT_PUBLIC_DEFAULT_M3U_URL` / `NEXT_PUBLIC_DEFAULT_EPG_URL`.

3. **Run development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

4. **Production build:**
   ```bash
   npm run build
   npm start
   ```

---

## Installing as a PWA on iPhone / Desktop

- **iOS Safari:** Open KinoStream in Safari, tap **Share**, and select **Add to Home Screen**. Launches full-screen without Safari toolbars.
- **Desktop Chrome / Edge:** Click the **Install KinoStream** icon in the address bar.

---

## License

MIT License — see [LICENSE](LICENSE).
