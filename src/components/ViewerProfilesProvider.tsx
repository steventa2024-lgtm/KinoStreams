'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthGate';
import {
  addViewerProfile,
  defaultViewerProfile,
  deleteViewerProfile,
  normalizeViewerAccount,
  parseViewerProfiles,
  serializeViewerProfiles,
  updateViewerProfile,
  viewerProfilesStorageKey,
  type ViewerProfile,
  type ViewerProfileActionResult,
  type ViewerProfileMutationResult,
} from '@/lib/viewer-profiles';

export interface ViewerProfilesContextValue {
  profiles: ViewerProfile[];
  activeProfile: ViewerProfile | null;
  ready: boolean;
  pickerOpen: boolean;
  storageNotice: string | null;
  selectProfile: (id: string) => ViewerProfileActionResult;
  openPicker: () => void;
  closePicker: () => void;
  addProfile: (name: string, avatarId: string) => ViewerProfileMutationResult;
  updateProfile: (id: string, name: string, avatarId: string) => ViewerProfileMutationResult;
  deleteProfile: (id: string) => ViewerProfileActionResult;
}

interface ProfileSessionState {
  account: string | null;
  profiles: ViewerProfile[];
  activeId: string | null;
  ready: boolean;
  pickerOpen: boolean;
  storageNotice: string | null;
}

const EMPTY_STATE: ProfileSessionState = {
  account: null, profiles: [], activeId: null, ready: false, pickerOpen: false, storageNotice: null,
};
const UNAVAILABLE_NOTICE = "Browser storage isn't available. Your profile changes will last for this visit.";
const UNSAVED_NOTICE = "Your profile changes are available for this visit, but couldn't be saved on this device.";
const NOT_READY_ERROR = 'Viewing profiles are not ready for this signed-in account yet.';
const ViewerProfilesContext = createContext<ViewerProfilesContextValue | null>(null);

function persist(account: string, profiles: readonly ViewerProfile[]): string | null {
  try {
    window.localStorage.setItem(viewerProfilesStorageKey(account), serializeViewerProfiles(account, profiles));
    return null;
  } catch {
    // Display edits remain usable even when quota/private browsing blocks persistence.
    return UNSAVED_NOTICE;
  }
}

/**
 * Wrap the existing app once per signed-in account, without keying it by profile.
 * This provider never changes auth, playback, watchlists, history, or source storage.
 * Profile mutations return success for in-memory edits even if storage is blocked;
 * storageNotice separately explains whether those edits will survive another visit.
 */
export function ViewerProfilesProvider({ children }: { children: React.ReactNode }) {
  const { authenticated, user } = useAuth();
  const account = authenticated && user?.email ? normalizeViewerAccount(user.email) : null;
  const [state, setState] = useState<ProfileSessionState>(EMPTY_STATE);
  const stateRef = useRef(state);
  const accountRef = useRef(account);
  const userRef = useRef(user);
  accountRef.current = account;
  userRef.current = user;

  const commit = useCallback((next: ProfileSessionState) => {
    // Keep back-to-back mutations consistent before React commits its next render.
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    if (!account) {
      commit(EMPTY_STATE);
      return;
    }
    let profiles: ViewerProfile[];
    let storageNotice: string | null = null;
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(viewerProfilesStorageKey(account));
    } catch {
      profiles = [defaultViewerProfile(userRef.current?.name, account)];
      commit({ account, profiles, activeId: null, ready: true, pickerOpen: true, storageNotice: UNAVAILABLE_NOTICE });
      return;
    }

    const parsed = parseViewerProfiles(raw, account);
    if (parsed.profiles) {
      profiles = parsed.profiles;
      if (parsed.status === 'repaired') storageNotice = persist(account, profiles);
    } else {
      profiles = [defaultViewerProfile(userRef.current?.name, account)];
      if (parsed.status === 'missing') {
        storageNotice = persist(account, profiles);
      } else {
        // Preserve malformed data until the user intentionally saves a profile edit.
        storageNotice = parsed.status === 'foreign-account'
          ? 'Saved profiles did not match this account. A separate default profile is ready.'
          : "Saved profiles couldn't be read. A default profile is ready; your next profile edit will save a new list.";
      }
    }
    // Deliberately ignore any old persisted selection. Every mounted sign-in starts here.
    commit({ account, profiles, activeId: null, ready: true, pickerOpen: true, storageNotice });
  }, [account, commit]);

  const currentSession = useCallback((): ProfileSessionState | null => {
    const current = stateRef.current;
    if (!account || accountRef.current !== account || current.account !== account || !current.ready) return null;
    return current;
  }, [account]);

  const selectProfile = useCallback((id: string): ViewerProfileActionResult => {
    const current = currentSession();
    if (!current) return { ok: false, error: NOT_READY_ERROR };
    if (!current.profiles.some((profile) => profile.id === id)) return { ok: false, error: 'This profile is no longer available.' };
    commit({ ...current, activeId: id, pickerOpen: false });
    return { ok: true };
  }, [commit, currentSession]);

  const openPicker = useCallback(() => {
    const current = currentSession();
    if (current) commit({ ...current, pickerOpen: true });
  }, [commit, currentSession]);

  const closePicker = useCallback(() => {
    const current = currentSession();
    // Initial sign-in still needs a deliberate viewing-profile selection.
    if (current?.activeId) commit({ ...current, pickerOpen: false });
  }, [commit, currentSession]);

  const addProfile = useCallback((name: string, avatarId: string): ViewerProfileMutationResult => {
    const current = currentSession();
    if (!current?.account) return { ok: false, error: NOT_READY_ERROR };
    const result = addViewerProfile(current.profiles, name, avatarId);
    if (!result.ok) return result;
    const storageNotice = persist(current.account, result.profiles);
    commit({ ...current, profiles: result.profiles, storageNotice });
    return { ok: true, profile: result.profile };
  }, [commit, currentSession]);

  const updateProfile = useCallback((id: string, name: string, avatarId: string): ViewerProfileMutationResult => {
    const current = currentSession();
    if (!current?.account) return { ok: false, error: NOT_READY_ERROR };
    const result = updateViewerProfile(current.profiles, id, name, avatarId);
    if (!result.ok) return result;
    const storageNotice = persist(current.account, result.profiles);
    commit({ ...current, profiles: result.profiles, storageNotice });
    return { ok: true, profile: result.profile };
  }, [commit, currentSession]);

  const deleteProfile = useCallback((id: string): ViewerProfileActionResult => {
    const current = currentSession();
    if (!current?.account) return { ok: false, error: NOT_READY_ERROR };
    const result = deleteViewerProfile(current.profiles, id);
    if (!result.ok) return result;
    const deletedActive = current.activeId === id;
    const storageNotice = persist(current.account, result.profiles);
    commit({
      ...current,
      profiles: result.profiles,
      activeId: deletedActive ? null : current.activeId,
      pickerOpen: deletedActive || current.pickerOpen,
      storageNotice,
    });
    return { ok: true };
  }, [commit, currentSession]);

  // Hide the previous account's display settings immediately, before effects run.
  const visibleState = state.account === account && account ? state : EMPTY_STATE;
  const value = useMemo<ViewerProfilesContextValue>(() => ({
    profiles: visibleState.profiles,
    activeProfile: visibleState.profiles.find((profile) => profile.id === visibleState.activeId) || null,
    ready: visibleState.ready,
    pickerOpen: visibleState.pickerOpen,
    storageNotice: visibleState.storageNotice,
    selectProfile, openPicker, closePicker, addProfile, updateProfile, deleteProfile,
  }), [visibleState, selectProfile, openPicker, closePicker, addProfile, updateProfile, deleteProfile]);

  return <ViewerProfilesContext.Provider value={value}>{children}</ViewerProfilesContext.Provider>;
}

export function useViewerProfiles(): ViewerProfilesContextValue {
  const context = useContext(ViewerProfilesContext);
  if (!context) throw new Error('useViewerProfiles must be used inside ViewerProfilesProvider.');
  return context;
}
