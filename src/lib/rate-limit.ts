import type { NextRequest } from 'next/server';

interface BucketEntry {
  timestamps: number[];
}

declare global {
  var __kinoRateLimitBuckets: Map<string, BucketEntry> | undefined;
}

function getBuckets(): Map<string, BucketEntry> {
  if (!globalThis.__kinoRateLimitBuckets) {
    globalThis.__kinoRateLimitBuckets = new Map<string, BucketEntry>();
  }
  return globalThis.__kinoRateLimitBuckets;
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): { allowed: boolean; retryAfterSeconds: number } {
  const buckets = getBuckets();
  const now = Date.now();
  const windowStart = now - params.windowMs;

  const existing = buckets.get(params.key);
  const active = (existing?.timestamps || []).filter((ts) => ts > windowStart);

  if (active.length >= params.limit) {
    const oldest = active[0];
    const retryAfterMs = Math.max(1000, oldest + params.windowMs - now);
    buckets.set(params.key, { timestamps: active });
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  active.push(now);
  buckets.set(params.key, { timestamps: active });

  // Opportunistic cleanup when map grows large
  if (buckets.size > 5000) {
    for (const [k, entry] of buckets.entries()) {
      const valid = entry.timestamps.filter((ts) => ts > windowStart);
      if (valid.length === 0) buckets.delete(k);
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}
