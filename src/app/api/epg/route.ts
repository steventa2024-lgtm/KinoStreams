import { NextRequest, NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth-crypto';
import { fetchAndCacheXmltvSchedules } from '@/lib/epg-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!requireApiSession(request)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const urlParam = request.nextUrl.searchParams.get('url');
  const epgUrls = [urlParam, process.env.NEXT_PUBLIC_DEFAULT_EPG_URL].filter(
    (v): v is string => Boolean(v && v.trim())
  );

  const { schedules, errors } = await fetchAndCacheXmltvSchedules(epgUrls);
  return NextResponse.json({
    schedules,
    generatedAt: new Date().toISOString(),
    errors,
  });
}

export async function POST(request: NextRequest) {
  if (!requireApiSession(request)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { urls?: string[] };
    const urls = Array.isArray(body.urls)
      ? body.urls.filter((u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u))
      : [];

    if (process.env.NEXT_PUBLIC_DEFAULT_EPG_URL) {
      urls.push(process.env.NEXT_PUBLIC_DEFAULT_EPG_URL);
    }

    const { schedules, errors } = await fetchAndCacheXmltvSchedules(urls);
    return NextResponse.json({
      schedules,
      generatedAt: new Date().toISOString(),
      errors,
    });
  } catch {
    const { schedules } = await fetchAndCacheXmltvSchedules([]);
    return NextResponse.json({
      schedules,
      generatedAt: new Date().toISOString(),
      errors: ['Invalid EPG request payload'],
    });
  }
}
