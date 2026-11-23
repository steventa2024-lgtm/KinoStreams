'use client';

import { useState } from 'react';
import { Film } from 'lucide-react';
import { getProfileAvatar } from '@/lib/profile-avatars';
import { cn } from '@/lib/utils';

export function ProfileAvatar({ avatarId, alt = '', className, loading = 'eager' }: {
  avatarId: string;
  alt?: string;
  className?: string;
  loading?: 'eager' | 'lazy';
}) {
  const avatar = getProfileAvatar(avatarId);
  const [failedId, setFailedId] = useState<string | null>(null);

  return (
    <span className={cn('kino-profile-art', className)}>
      {failedId === avatar.id ? (
        <span className="kino-profile-art__fallback" role={alt ? 'img' : undefined} aria-label={alt || undefined}>
          <Film size={34} aria-hidden="true" />
        </span>
      ) : (
        <img
          src={avatar.src}
          alt={alt}
          width={200}
          height={200}
          draggable={false}
          loading={loading}
          decoding="async"
          style={{ objectPosition: avatar.position || 'center' }}
          onError={() => setFailedId(avatar.id)}
        />
      )}
    </span>
  );
}
