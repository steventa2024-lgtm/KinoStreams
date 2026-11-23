export type ProfileAvatarCollection = 'Cinema' | 'Animation' | 'Series';

export interface ProfileAvatar {
  id: string;
  name: string;
  collection: ProfileAvatarCollection;
  src: string;
  /** Optional CSS object-position for artwork that needs a different focal point. */
  position?: string;
}

/** Local character artwork. Source attribution is in public/avatars/SOURCES.md. */
export const PROFILE_AVATARS: readonly ProfileAvatar[] = [
  { id: 'kora', name: 'Kora', collection: 'Cinema', src: '/avatars/kora.png' },
  { id: 'jimmy', name: 'Jimmy', collection: 'Cinema', src: '/avatars/jimmy.png' },
  { id: 'the-creature', name: 'The Creature', collection: 'Cinema', src: '/avatars/the-creature.png' },
  { id: 'santa-claus', name: 'Santa Claus', collection: 'Cinema', src: '/avatars/santa-claus.png' },
  { id: 'nick-jakoby', name: 'Nick Jakoby', collection: 'Cinema', src: '/avatars/nick-jakoby.png' },
  { id: 'jinx', name: 'Jinx', collection: 'Animation', src: '/avatars/jinx.png' },
  { id: 'vi', name: 'Vi', collection: 'Animation', src: '/avatars/vi.png' },
  { id: 'sonic', name: 'Sonic', collection: 'Animation', src: '/avatars/sonic.png' },
  { id: 'pikachu', name: 'Pikachu', collection: 'Animation', src: '/avatars/pikachu.png' },
  { id: 'rumi', name: 'Rumi', collection: 'Animation', src: '/avatars/rumi.png' },
  { id: 'wednesday', name: 'Wednesday', collection: 'Series', src: '/avatars/wednesday.png' },
  { id: 'eleven', name: 'Eleven', collection: 'Series', src: '/avatars/eleven.png' },
  { id: 'geralt', name: 'Geralt', collection: 'Series', src: '/avatars/geralt.png' },
  { id: 'luffy', name: 'Luffy', collection: 'Series', src: '/avatars/luffy.png' },
  { id: 'front-man', name: 'Front Man', collection: 'Series', src: '/avatars/front-man.png' },
];

export const DEFAULT_PROFILE_AVATAR_ID = 'jinx';

const defaultAvatar = PROFILE_AVATARS.find((avatar) => avatar.id === DEFAULT_PROFILE_AVATAR_ID)!;

/** Older, missing, or unrecognized stored IDs always resolve to usable artwork. */
export function getProfileAvatar(id?: string | null): ProfileAvatar {
  return PROFILE_AVATARS.find((avatar) => avatar.id === id) ?? defaultAvatar;
}
