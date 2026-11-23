'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Check, ChevronRight, Loader2, LogOut, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '@/components/AuthGate';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { useViewerProfiles } from '@/components/ViewerProfilesProvider';
import { siteConfig } from '@/config/site';
import { DEFAULT_PROFILE_AVATAR_ID, PROFILE_AVATARS, getProfileAvatar } from '@/lib/profile-avatars';
import { MAX_VIEWER_PROFILES, VIEWER_PROFILE_NAME_LIMIT, type ViewerProfile } from '@/lib/viewer-profiles';

type Screen = 'choose' | 'edit' | 'avatars' | 'delete';
type Draft = { id: string | null; name: string; avatarId: string };

export function ViewerProfileGate({ children }: { children: React.ReactNode }) {
  const { ready, activeProfile, pickerOpen } = useViewerProfiles();
  const pathname = usePathname();
  const [hasEntered, setHasEntered] = useState(false);
  const profileSelected = Boolean(activeProfile);

  useEffect(() => {
    if (profileSelected) setHasEntered(true);
  }, [profileSelected]);

  if (pathname.startsWith('/verify-email')) return <>{children}</>;

  if (!ready) {
    return (
      <div className="kino-profiles-loading" role="status">
        <span className="kino-wordmark">{siteConfig.wordmark}</span>
        <Loader2 size={23} className="kino-profiles-spinner" aria-hidden="true" />
        <span className="sr-only">Loading your profiles</span>
      </div>
    );
  }

  return (
    <>
      {(profileSelected || hasEntered) && <div inert={pickerOpen || undefined} aria-hidden={pickerOpen || undefined}>{children}</div>}
      {pickerOpen && <ViewerProfileScreen />}
    </>
  );
}

function ViewerProfileScreen() {
  const { signOut } = useAuth();
  const {
    profiles, activeProfile, storageNotice,
    selectProfile, closePicker, addProfile, updateProfile, deleteProfile,
  } = useViewerProfiles();
  const [screen, setScreen] = useState<Screen>('choose');
  const [managing, setManaging] = useState(false);
  const [draft, setDraft] = useState<Draft>({ id: null, name: '', avatarId: DEFAULT_PROFILE_AVATAR_ID });
  const [avatarCollection, setAvatarCollection] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const collectionListRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const nameId = useId();
  const errorId = useId();
  const avatarResultsId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      // React removes the background inert state after this cleanup.
      requestAnimationFrame(() => {
        if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      });
    };
  }, []);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    dialogRef.current?.scrollTo({ top: 0 });
  }, [screen, managing]);

  useEffect(() => {
    if (screen !== 'avatars') return;
    const list = collectionListRef.current;
    const selected = list?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (!list || !selected) return;
    // Keep the active collection visible in the compact mobile chip rail.
    if (selected.offsetLeft < list.scrollLeft) list.scrollLeft = selected.offsetLeft;
    else if (selected.offsetLeft + selected.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = selected.offsetLeft + selected.offsetWidth - list.clientWidth;
    }
  }, [screen, avatarCollection]);

  const goBack = () => {
    setError(null);
    if (screen === 'avatars' || screen === 'delete') setScreen('edit');
    else if (screen === 'edit') setScreen('choose');
    else if (managing) setManaging(false);
    else closePicker();
  };

  const editProfile = (profile?: ViewerProfile) => {
    setDraft(profile ? { ...profile } : { id: null, name: '', avatarId: DEFAULT_PROFILE_AVATAR_ID });
    setError(null);
    setScreen('edit');
  };

  const openAvatarPicker = () => {
    setAvatarCollection(getProfileAvatar(draft.avatarId).collection);
    setError(null);
    setScreen('avatars');
  };

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = draft.id
      ? updateProfile(draft.id, draft.name, draft.avatarId)
      : addProfile(draft.name, draft.avatarId);
    if (!result.ok) { setError(result.error); return; }
    setError(null);
    setScreen('choose');
    setManaging(false);
  };

  const removeProfile = () => {
    if (!draft.id) return;
    const result = deleteProfile(draft.id);
    if (!result.ok) { setError(result.error); return; }
    setError(null);
    setScreen('choose');
  };

  const chooseProfile = (id: string) => {
    const result = selectProfile(id);
    if (!result.ok) setError(result.error);
  };

  const title = screen === 'avatars' ? 'Choose your character.'
    : screen === 'delete' ? 'Delete this profile?'
    : screen === 'edit' ? draft.id ? 'Make it yours.' : 'A space of your own.'
    : managing ? 'Manage profiles.' : 'Who’s watching?';

  const collections = [...new Set(PROFILE_AVATARS.map((avatar) => avatar.collection))];
  const visibleCollections = collections.filter((collection) => avatarCollection === 'all' || collection === avatarCollection);
  const visibleAvatarCount = PROFILE_AVATARS.filter((avatar) => avatarCollection === 'all' || avatar.collection === avatarCollection).length;

  return (
    <dialog
      ref={dialogRef}
      className="kino-profiles"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); goBack(); }}
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <header className="kino-profiles__header">
        <span className="kino-wordmark">{siteConfig.wordmark}</span>
        {activeProfile ? (
          <button type="button" className="kino-profiles__close" onClick={closePicker} aria-label="Close profiles">
            <X size={20} aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className="kino-profiles__signout" disabled={signingOut} onClick={async () => {
            setSigningOut(true);
            try { await signOut(); } finally { setSigningOut(false); }
          }}>
            <LogOut size={14} aria-hidden="true" />{signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        )}
      </header>

      <main className={`kino-profiles__main kino-profiles__main--${screen}`}>
        {screen !== 'choose' && (
          <button type="button" className="kino-profiles__back" onClick={goBack}>
            <ArrowLeft size={17} aria-hidden="true" />{screen === 'avatars' || screen === 'delete' ? 'Back to profile' : 'All profiles'}
          </button>
        )}

        <div className="kino-profiles__heading" key={`${screen}-${managing}`}>
          <p className="kino-profiles__eyebrow">{screen === 'avatars' ? 'PICK YOUR FAVORITE' : 'YOUR KINOSTREAM'}</p>
          <h1 id={titleId} tabIndex={-1} ref={headingRef}>{title}</h1>
          <p className="kino-profiles__subtitle">
            {screen === 'choose' ? managing ? 'Select a profile to change its name or avatar.' : 'Choose a profile. Find your next favorite.'
              : screen === 'edit' ? 'Give your profile a name and a familiar face.'
              : screen === 'avatars' ? `${PROFILE_AVATARS.length} characters. Find a familiar face for your next great watch.`
              : `“${draft.name}” will be removed from this device.`}
          </p>
        </div>

        {screen === 'choose' && (
          <>
            <div className="kino-profiles__grid" aria-label={managing ? 'Edit a profile' : 'Choose a viewing profile'}>
              {profiles.map((profile, index) => (
                <button
                  type="button"
                  key={profile.id}
                  className={`kino-profile-tile${managing ? ' kino-profile-tile--editing' : ''}`}
                  style={{ animationDelay: `${index * 45}ms` }}
                  onClick={() => managing ? editProfile(profile) : chooseProfile(profile.id)}
                  aria-label={managing ? `Edit ${profile.name}` : `Watch as ${profile.name}`}
                >
                  <span className="kino-profile-tile__image">
                    <ProfileAvatar avatarId={profile.avatarId} />
                    {managing ? (
                      <span className="kino-profile-tile__edit"><Pencil size={16} aria-hidden="true" /></span>
                    ) : activeProfile?.id === profile.id ? (
                      <span className="kino-profile-tile__current" aria-label="Current profile"><Check size={13} aria-hidden="true" /></span>
                    ) : null}
                  </span>
                  <span className="kino-profile-tile__name">{profile.name}</span>
                </button>
              ))}
              {profiles.length < MAX_VIEWER_PROFILES && (
                <button type="button" className="kino-profile-tile kino-profile-tile--add" onClick={() => editProfile()} style={{ animationDelay: `${profiles.length * 45}ms` }}>
                  <span className="kino-profile-tile__image"><span className="kino-profile-tile__plus"><Plus size={33} strokeWidth={1.5} aria-hidden="true" /></span></span>
                  <span className="kino-profile-tile__name">Add profile</span>
                </button>
              )}
            </div>
            <button type="button" className={`kino-profiles__button ${managing ? 'kino-profiles__button--primary' : 'kino-profiles__button--quiet'}`} onClick={() => { setManaging(!managing); setError(null); }}>
              {managing ? <Check size={15} aria-hidden="true" /> : <Pencil size={14} aria-hidden="true" />}
              {managing ? 'Done' : 'Manage profiles'}
            </button>
          </>
        )}

        {screen === 'edit' && (
          <form className="kino-profile-editor" onSubmit={saveProfile} noValidate>
            <div className="kino-profile-editor__fields">
              <button type="button" className="kino-profile-editor__avatar" onClick={openAvatarPicker} aria-label="Choose an avatar">
                <ProfileAvatar avatarId={draft.avatarId} alt={getProfileAvatar(draft.avatarId).name} />
                <span className="kino-profile-editor__pencil"><Pencil size={15} aria-hidden="true" /></span>
              </button>
              <div className="kino-profile-editor__name">
                <label htmlFor={nameId}>Profile name</label>
                <input
                  id={nameId}
                  name="profile-name"
                  type="text"
                  value={draft.name}
                  onChange={(event) => { setDraft({ ...draft, name: event.target.value }); setError(null); }}
                  placeholder="Enter a name"
                  autoComplete="off"
                  maxLength={VIEWER_PROFILE_NAME_LIMIT}
                  required
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : undefined}
                />
                <button type="button" className="kino-profile-editor__change" onClick={openAvatarPicker}>
                  Choose a different avatar<ChevronRight size={13} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="kino-profile-editor__actions">
              <button type="submit" className="kino-profiles__button kino-profiles__button--primary">{draft.id ? 'Save changes' : 'Create profile'}</button>
              <button type="button" className="kino-profiles__button kino-profiles__button--quiet" onClick={goBack}>Cancel</button>
              {draft.id && profiles.length > 1 && (
                <button type="button" className="kino-profile-editor__delete" onClick={() => { setScreen('delete'); setError(null); }}>
                  <Trash2 size={14} aria-hidden="true" />Delete profile
                </button>
              )}
            </div>
          </form>
        )}

        {screen === 'avatars' && (
          <div className="kino-avatar-catalog">
            <div className="kino-avatar-catalog__toolbar">
              <div ref={collectionListRef} className="kino-avatar-collections" role="group" aria-label="Avatar collections">
                <button
                  type="button"
                  className={`kino-avatar-collection${avatarCollection === 'all' ? ' is-active' : ''}`}
                  aria-label={`All collections, ${PROFILE_AVATARS.length} characters`}
                  aria-pressed={avatarCollection === 'all'}
                  aria-controls={avatarResultsId}
                  onClick={() => setAvatarCollection('all')}
                >
                  All<span aria-hidden="true">{PROFILE_AVATARS.length}</span>
                </button>
                {collections.map((collection) => (
                  <button
                    type="button"
                    key={collection}
                    className={`kino-avatar-collection${avatarCollection === collection ? ' is-active' : ''}`}
                    aria-label={`${collection}, ${PROFILE_AVATARS.filter((avatar) => avatar.collection === collection).length} characters`}
                    aria-pressed={avatarCollection === collection}
                    aria-controls={avatarResultsId}
                    onClick={() => setAvatarCollection(collection)}
                  >
                    {collection}<span aria-hidden="true">{PROFILE_AVATARS.filter((avatar) => avatar.collection === collection).length}</span>
                  </button>
                ))}
              </div>
              <p className="kino-avatar-catalog__count" role="status">Showing {visibleAvatarCount} characters</p>
            </div>
            <div id={avatarResultsId} className="kino-avatar-catalog__results">
              {visibleCollections.map((collection) => (
                <section className="kino-avatar-catalog__section" key={collection} aria-label={collection}>
                  <h2>{collection}</h2>
                  <div className="kino-avatar-catalog__grid">
                    {PROFILE_AVATARS.filter((avatar) => avatar.collection === collection).map((avatar) => (
                      <button type="button" className={`kino-avatar-option${draft.avatarId === avatar.id ? ' is-selected' : ''}`} key={avatar.id} aria-label={`Choose ${avatar.name} avatar`} aria-pressed={draft.avatarId === avatar.id} onClick={() => { setDraft({ ...draft, avatarId: avatar.id }); setScreen('edit'); }}>
                        <span className="kino-avatar-option__art"><ProfileAvatar avatarId={avatar.id} loading="lazy" />{draft.avatarId === avatar.id && <span className="kino-avatar-option__check"><Check size={14} aria-hidden="true" /></span>}</span>
                        <span className="kino-avatar-option__name">{avatar.name}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

        {screen === 'delete' && (
          <div className="kino-profile-delete">
            <ProfileAvatar avatarId={draft.avatarId} />
            <p>Your account, saved titles, and watch history will stay.</p>
            <div className="kino-profile-editor__actions">
              <button type="button" className="kino-profiles__button kino-profiles__button--primary" onClick={removeProfile}>Delete profile</button>
              <button type="button" className="kino-profiles__button kino-profiles__button--quiet" onClick={goBack}>Keep profile</button>
            </div>
          </div>
        )}

        {error && <p id={errorId} className="kino-profiles__error" role="alert">{error}</p>}
        {storageNotice && <p className="kino-profiles__notice" role="status">{storageNotice}</p>}
      </main>

      <footer className="kino-profiles__footer">
        {screen === 'choose' ? 'Your people. Your picks. Press play.' : 'Profiles are saved on this device.'}
      </footer>
    </dialog>
  );
}
