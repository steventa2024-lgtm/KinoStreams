'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { siteConfig } from '@/config/site';
import { setActiveUserScope } from '@/lib/storage';
import { cn } from '@/lib/utils';

export interface AuthUser {
  email: string;
  name?: string;
  provider: 'email' | 'google';
}

export interface InitialAuthSession {
  authenticated: boolean;
  user: AuthUser | null;
  googleEnabled: boolean;
  emailDeliveryConfigured: boolean;
}

interface AuthContextValue {
  authenticated: boolean;
  user: AuthUser | null;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthGate');
  }
  return ctx;
}

type AuthStage = 'email-entry' | 'waiting-verification' | 'enter-code';
type AuthMode = 'signin' | 'signup';

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

export function AuthGate({
  initialSession,
  children,
}: {
  initialSession: InitialAuthSession;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [authenticated, setAuthenticated] = useState(initialSession.authenticated);
  const [user, setUser] = useState<AuthUser | null>(initialSession.user);
  const [googleEnabled, setGoogleEnabled] = useState(initialSession.googleEnabled);
  const [stage, setStage] = useState<AuthStage>('email-entry');
  const [mode, setMode] = useState<AuthMode>('signin');

  // Form & challenge states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | undefined>(undefined);
  const [devCode, setDevCode] = useState<string | undefined>(undefined);
  const [authProviderLabel, setAuthProviderLabel] = useState<'email' | 'google'>('email');

  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);
  const isVerifyEmailRoute = pathname?.startsWith('/verify-email');

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 5000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as {
        authenticated: boolean;
        user: AuthUser | null;
        googleEnabled: boolean;
      };
      setAuthenticated(Boolean(data.authenticated));
      setUser(data.user || null);
      setActiveUserScope(data.authenticated && data.user?.email ? data.user.email : null);
      setGoogleEnabled(Boolean(data.googleEnabled));
    } catch {
      // Keep current session state on transient fetch error
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setActiveUserScope(null);
      setAuthenticated(false);
      setUser(null);
      setStage('email-entry');
      setMode('signin');
      setPassword('');
      setChallengeId(null);
      setVerifiedToken(null);
      setDigits(['', '', '', '', '', '']);
      setErrorMsg(null);
      router.push('/');
      router.refresh();
    }
  }, [router]);

  // Handle Google OAuth challenge handoff OR OAuth feedback errors
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const oauthChallenge = params.get('oauth_challenge');
    const oauthEmail = params.get('email');
    const authError = params.get('auth_error');

    if (oauthChallenge && oauthEmail) {
      setAuthenticated(false);
      setUser(null);
      setEmail(oauthEmail);
      setChallengeId(oauthChallenge);
      setAuthProviderLabel('google');
      setErrorMsg(null);
      setStage('waiting-verification');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (authError === 'google_not_configured') {
      showToast(
        'Google Sign-In is not configured yet. Add GOOGLE_CLIENT_ID in .env.local or use Email Sign-In.'
      );
      window.history.replaceState({}, '', window.location.pathname);
    } else if (authError === 'account_not_found') {
      setAuthenticated(false);
      setUser(null);
      setMode('signup');
      if (oauthEmail) {
        setEmail(oauthEmail);
      }
      setErrorMsg(
        oauthEmail
          ? `No KinoStream account found for ${oauthEmail}. Please create an account and complete verification first.`
          : 'No KinoStream account found for this Google email. Please create an account first.'
      );
      window.history.replaceState({}, '', window.location.pathname);
    } else if (authError) {
      setErrorMsg('Google sign-in could not be completed. Please try again or use Email.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [showToast]);

  // Sync session on mount
  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  // Stage 2 Polling (every 2.5s) + BroadcastChannel listener
  useEffect(() => {
    if (authenticated || stage !== 'waiting-verification' || !challengeId) return;

    let cancelled = false;

    const advanceToCodeStage = (vToken: string, previewCode?: string) => {
      if (cancelled) return;
      setVerifiedToken(vToken);
      if (previewCode) setDevCode(previewCode);
      setErrorMsg(null);
      setStage('enter-code');
      setTimeout(() => digitRefs.current[0]?.focus(), 60);
    };

    const pollStatus = async () => {
      try {
        const res = await fetch(
          `/api/auth/email/status?challengeId=${encodeURIComponent(challengeId)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          verified?: boolean;
          verifiedToken?: string;
          devPreview?: { enabled: boolean; code?: string };
        };
        if (data.verified && data.verifiedToken) {
          advanceToCodeStage(data.verifiedToken, data.devPreview?.code);
        }
      } catch {
        // Retry on next interval
      }
    };

    const interval = setInterval(() => {
      void pollStatus();
    }, 2500);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('kinostream-auth');
        bc.onmessage = (event) => {
          const payload = event.data as {
            type?: string;
            verifiedToken?: string;
            devPreview?: { enabled: boolean; code?: string };
          };
          if (payload?.type === 'email_verified' && payload.verifiedToken) {
            advanceToCodeStage(payload.verifiedToken, payload.devPreview?.code);
          } else if (payload?.type === 'auth_completed') {
            void refreshSession().then(() => router.refresh());
          }
        };
      } catch {
        // Ignore BroadcastChannel errors
      }
    }

    return () => {
      cancelled = true;
      clearInterval(interval);
      bc?.close();
    };
  }, [authenticated, stage, challengeId, refreshSession, router]);

  // Listen for auth completion on enter-code stage if user finished in the email link tab
  useEffect(() => {
    if (authenticated || stage !== 'enter-code') return;
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('kinostream-auth');
        bc.onmessage = (event) => {
          const payload = event.data as { type?: string };
          if (payload?.type === 'auth_completed') {
            void refreshSession().then(() => router.refresh());
          }
        };
      } catch {
        // Ignore BroadcastChannel errors
      }
    }
    const onFocus = () => {
      void refreshSession();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      bc?.close();
      window.removeEventListener('focus', onFocus);
    };
  }, [authenticated, stage, refreshSession, router]);

  const handleGoogleContinue = () => {
    setErrorMsg(null);
    if (!googleEnabled) {
      showToast(
        'Add GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET in .env.local to enable Google Sign-In, or use Email below.'
      );
      return;
    }
    window.location.href = `/api/auth/google?mode=${mode}`;
  };

  // Existing account Sign-In (Email + Password, instant access without re-verification)
  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleaned, password }),
      });
      const data = (await res.json()) as {
        authenticated?: boolean;
        user?: AuthUser;
        error?: string;
        code?: string;
      };
      if (!res.ok || !data.authenticated) {
        if (data.code === 'ACCOUNT_NOT_FOUND') {
          setErrorMsg(data.error || 'No account found. Switch to Create Account.');
        } else {
          setErrorMsg(data.error || 'Incorrect email or password.');
        }
        return;
      }

      setActiveUserScope((data.user?.email || cleaned).trim().toLowerCase());
      setAuthenticated(true);
      setUser(data.user || { email: cleaned, provider: 'email' });
      router.refresh();
    } catch {
      setErrorMsg('Unable to sign in right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Create Account (Two-Step Email Verification -> 6-Digit Code)
  const handleCreateAccountStart = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleaned = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/email/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleaned, password }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        challengeId?: string;
        email?: string;
        error?: string;
        code?: string;
        devPreview?: { enabled: boolean; verifyUrl?: string };
      };
      if (!res.ok || !data.challengeId) {
        if (data.code === 'ACCOUNT_EXISTS') {
          setMode('signin');
          setErrorMsg(data.error || 'Account already exists. Please sign in.');
          return;
        }
        throw new Error(data.error || 'Unable to send verification email.');
      }

      setEmail(data.email || cleaned);
      setChallengeId(data.challengeId);
      if (stage === 'email-entry') {
        setAuthProviderLabel('email');
      }
      setDevVerifyUrl(data.devPreview?.verifyUrl);
      setDevCode(undefined);
      setStage('waiting-verification');
      if (stage === 'waiting-verification') {
        showToast('Verification email resent. Check your inbox.');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to start account verification.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!challengeId || !verifiedToken || resending) return;
    setResending(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/email/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, verifiedToken }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        verifiedToken?: string;
        error?: string;
        devPreview?: { enabled: boolean; code?: string };
      };
      if (!res.ok || !data.verifiedToken) {
        throw new Error(data.error || 'Unable to resend code.');
      }
      setVerifiedToken(data.verifiedToken);
      setDevCode(data.devPreview?.code);
      setDigits(['', '', '', '', '', '']);
      digitRefs.current[0]?.focus();
      showToast('A fresh 6-digit code has been sent to your email.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to resend code.');
    } finally {
      setResending(false);
    }
  };

  const submitVerificationCode = useCallback(
    async (fullCode: string) => {
      if (!challengeId || !verifiedToken || fullCode.length !== 6) return;
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch('/api/auth/email/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challengeId,
            verifiedToken,
            code: fullCode,
          }),
        });
        const data = (await res.json()) as {
          authenticated?: boolean;
          user?: AuthUser;
          error?: string;
        };
        if (!res.ok || !data.authenticated) {
          throw new Error(data.error || 'Invalid 6-digit verification code.');
        }

        setActiveUserScope((data.user?.email || email).trim().toLowerCase());
        setAuthenticated(true);
        setUser(data.user || { email, provider: 'email' });
        router.refresh();
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : 'Unable to verify code.'
        );
        setDigits(['', '', '', '', '', '']);
        digitRefs.current[0]?.focus();
      } finally {
        setLoading(false);
      }
    },
    [challengeId, verifiedToken, email, router]
  );

  const handleDigitChange = (index: number, rawValue: string) => {
    const cleaned = rawValue.replace(/\D/g, '');
    if (cleaned.length > 1) {
      const slice = cleaned.slice(0, 6).split('');
      const next = ['', '', '', '', '', ''];
      slice.forEach((ch, idx) => {
        next[idx] = ch;
      });
      setDigits(next);
      setErrorMsg(null);
      const focusIdx = Math.min(slice.length, 5);
      digitRefs.current[focusIdx]?.focus();
      if (slice.length === 6) {
        void submitVerificationCode(next.join(''));
      }
      return;
    }

    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    setErrorMsg(null);

    if (cleaned && index < 5) {
      digitRefs.current[index + 1]?.focus();
    }

    const joined = next.join('');
    if (joined.length === 6) {
      void submitVerificationCode(joined);
    }
  };

  const handleDigitKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    pasted.split('').forEach((ch, idx) => {
      next[idx] = ch;
    });
    setDigits(next);
    setErrorMsg(null);
    const focusIdx = Math.min(pasted.length, 5);
    digitRefs.current[focusIdx]?.focus();
    if (pasted.length === 6) {
      void submitVerificationCode(pasted);
    }
  };

  if (isVerifyEmailRoute || authenticated) {
    return (
      <AuthContext.Provider
        value={{
          authenticated,
          user,
          refreshSession,
          signOut,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        authenticated: false,
        user: null,
        refreshSession,
        signOut,
      }}
    >
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-x-hidden bg-[#09090B] px-4 py-8 pt-safe pb-safe">
        {/* Cinema Vignette & Champagne-Gold Ambient Glow */}
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.16),transparent_55%)]" />
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(212,175,55,0.08),transparent_50%)]" />

        {/* Subtle Toast Banner */}
        {toastMsg && (
          <div
            role="status"
            className="fixed top-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-[#D4AF37]/40 bg-[#121215]/95 px-4 py-3 text-center text-xs font-medium text-[#E2C275] shadow-2xl backdrop-blur-xl pt-safe"
          >
            {toastMsg}
          </div>
        )}

        {/* Centered Frosted-Glass Auth Card */}
        <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/[0.08] bg-[#121215]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.85)] backdrop-blur-2xl sm:p-8">
          {/* Editorial Brand Header */}
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#D4AF37]/45 bg-[#09090B] font-serif text-lg font-bold text-[#D4AF37] shadow-[0_0_24px_rgba(212,175,55,0.25)]">
              K
            </div>
            <h1 className="font-serif text-2xl font-semibold tracking-[0.22em] text-[#FAFAFA] sm:text-3xl">
              {siteConfig.wordmark}
            </h1>
            <p className="mt-1 text-[10px] font-semibold tracking-[0.28em] text-[#71717A] uppercase">
              BY {siteConfig.creator.toUpperCase()}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-[#A1A1AA] sm:text-sm">
              Private live television, sports match center, and curated cinema.
            </p>
          </div>

          {/* Stage 1: Sign In / Create Account */}
          {stage === 'email-entry' && (
            <div className="mt-6 space-y-5">
              {/* Sign In / Create Account Mode Switcher */}
              <div className="grid grid-cols-2 rounded-full border border-white/[0.08] bg-[#09090B] p-1">
                {[
                  { id: 'signin' as const, label: 'Sign In' },
                  { id: 'signup' as const, label: 'Create Account' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setMode(tab.id);
                      setErrorMsg(null);
                    }}
                    className={cn(
                      'min-h-[44px] rounded-full text-xs font-semibold transition',
                      mode === tab.id
                        ? 'bg-[#D4AF37] text-[#09090B]'
                        : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleGoogleContinue}
                className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-full border border-white/15 bg-[#FAFAFA] px-5 text-sm font-semibold text-[#09090B] transition hover:bg-[#E2C275] active:scale-[0.99]"
              >
                <GoogleGlyph />
                Continue with Google
              </button>

              <div className="relative flex items-center py-0.5">
                <div className="flex-1 border-t border-white/[0.08]" />
                <span className="px-3 text-[10px] font-semibold tracking-[0.2em] text-[#71717A] uppercase">
                  {mode === 'signin' ? 'OR SIGN IN WITH EMAIL' : 'OR CREATE WITH EMAIL'}
                </span>
                <div className="flex-1 border-t border-white/[0.08]" />
              </div>

              <form
                onSubmit={
                  mode === 'signin' ? handlePasswordSignIn : handleCreateAccountStart
                }
                className="space-y-3"
              >
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[#71717A]" />
                  <input
                    id="kino-auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="you@domain.com"
                    className="min-h-[48px] w-full rounded-2xl border border-white/[0.08] bg-[#09090B] pr-4 pl-11 text-sm text-[#FAFAFA] placeholder-[#71717A] focus:border-[#D4AF37]/60 focus:outline-none"
                  />
                </div>

                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[#71717A]" />
                  <input
                    id="kino-auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={mode === 'signup' ? 6 : 1}
                    autoComplete={
                      mode === 'signin' ? 'current-password' : 'new-password'
                    }
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder={
                      mode === 'signin'
                        ? 'Your password'
                        : 'Create password (6+ characters)'
                    }
                    className="min-h-[48px] w-full rounded-2xl border border-white/[0.08] bg-[#09090B] pr-12 pl-11 text-sm text-[#FAFAFA] placeholder-[#71717A] focus:border-[#D4AF37]/60 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute top-1/2 right-1.5 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-xl text-[#71717A] hover:text-[#FAFAFA]"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {errorMsg && (
                  <p className="text-center text-xs font-medium text-[#EF4444]">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#D4AF37] px-6 text-sm font-semibold text-[#09090B] shadow-[0_0_24px_rgba(212,175,55,0.28)] transition hover:bg-[#E2C275] active:scale-[0.99] disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
              </form>

              <p className="text-center text-xs text-[#71717A]">
                {mode === 'signin' ? (
                  <>
                    New to KinoStream?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signup');
                        setErrorMsg(null);
                      }}
                      className="font-semibold text-[#E2C275] hover:underline"
                    >
                      Create Account
                    </button>
                  </>
                ) : (
                  <>
                    Already verified an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin');
                        setErrorMsg(null);
                      }}
                      className="font-semibold text-[#E2C275] hover:underline"
                    >
                      Sign In
                    </button>
                  </>
                )}
              </p>
            </div>
          )}

          {/* Stage 2: Waiting for Email Link Verification */}
          {stage === 'waiting-verification' && (
            <div className="mt-7 space-y-5 text-center">
              <div className="rounded-2xl border border-[#D4AF37]/25 bg-[#09090B]/75 p-5">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]">
                  <Mail className="h-5 w-5" />
                </div>

                {authProviderLabel === 'google' && (
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold tracking-wider text-[#E2C275] uppercase">
                    Google Account Confirmed · One-Time Verification
                  </p>
                )}

                <h2 className="mt-3 font-serif text-xl font-medium text-[#FAFAFA]">
                  Check Your Inbox
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-[#A1A1AA]">
                  We sent a verification link to{' '}
                  <span className="font-semibold text-[#FAFAFA]">{email}</span>. Tap
                  the link in that email to receive your 6-digit code and finish setting up your account.
                </p>

                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3.5 py-1.5 text-[11px] font-medium text-[#E2C275]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#D4AF37]" />
                  Waiting for email verification...
                </div>
              </div>

              {devVerifyUrl && (
                <div className="rounded-2xl border border-white/[0.08] bg-[#09090B]/80 p-3.5 text-xs text-[#A1A1AA]">
                  <p className="font-semibold text-[#E2C275]">
                    Local Dev Fallback (No Resend Key)
                  </p>
                  <a
                    href={devVerifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-block break-all text-[11px] text-[#D4AF37] underline"
                  >
                    Open Verification Link ↗
                  </a>
                </div>
              )}

              {errorMsg && (
                <p className="text-xs font-medium text-[#EF4444]">{errorMsg}</p>
              )}

              <div className="space-y-2.5">
                {authProviderLabel !== 'google' && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void handleCreateAccountStart()}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-5 text-xs font-semibold text-[#E2C275] transition hover:bg-[#D4AF37] hover:text-[#09090B] disabled:opacity-50"
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                    Resend verification email
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setStage('email-entry');
                    setErrorMsg(null);
                  }}
                  className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full text-xs text-[#71717A] transition hover:text-[#FAFAFA]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Sign In
                </button>
              </div>
            </div>
          )}

          {/* Stage 3: Enter 6-Digit Code Screen */}
          {stage === 'enter-code' && (
            <div className="mt-7 space-y-5 text-center">
              <div>
                <div className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Email Verified
                </div>
                <h2 className="font-serif text-xl font-medium text-[#FAFAFA]">
                  Enter 6-Digit Code
                </h2>
                <p className="mt-1 text-xs text-[#A1A1AA]">
                  Enter the verification code sent to{' '}
                  <span className="font-medium text-[#FAFAFA]">{email}</span>.
                </p>
              </div>

              {/* 6 Individual Numeric Inputs */}
              <div className="grid grid-cols-6 gap-2 sm:gap-2.5">
                {digits.map((val, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      digitRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                    maxLength={6}
                    value={val}
                    aria-label={`Verification code digit ${idx + 1}`}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                    onPaste={handleDigitPaste}
                    className={cn(
                      'min-h-[52px] w-full rounded-xl border bg-[#09090B] text-center font-serif text-xl font-bold text-[#FAFAFA] transition focus:border-[#D4AF37] focus:outline-none',
                      val ? 'border-[#D4AF37]/60' : 'border-white/[0.12]'
                    )}
                  />
                ))}
              </div>

              {devCode && (
                <div className="rounded-xl border border-[#D4AF37]/30 bg-[#09090B]/75 px-3 py-2 text-xs text-[#A1A1AA]">
                  Dev Mode Code:{' '}
                  <strong className="font-serif tracking-widest text-[#E2C275]">
                    {devCode}
                  </strong>
                </div>
              )}

              {errorMsg && (
                <p className="text-xs font-medium text-[#EF4444]">{errorMsg}</p>
              )}

              <button
                type="button"
                disabled={loading || digits.join('').length !== 6}
                onClick={() => void submitVerificationCode(digits.join(''))}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#D4AF37] px-6 text-sm font-semibold text-[#09090B] transition hover:bg-[#E2C275] disabled:opacity-45"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify &amp; Enter KinoStream
              </button>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStage('email-entry');
                    setDigits(['', '', '', '', '', '']);
                    setErrorMsg(null);
                  }}
                  className="inline-flex min-h-[44px] items-center gap-1.5 text-xs text-[#71717A] hover:text-[#FAFAFA]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Start Over
                </button>

                <button
                  type="button"
                  disabled={resending}
                  onClick={() => void handleResendCode()}
                  className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-semibold text-[#E2C275] hover:underline disabled:opacity-50"
                >
                  <RefreshCw className={cn('h-3 w-3', resending && 'animate-spin')} />
                  Resend Code
                </button>
              </div>
            </div>
          )}

          {/* Security Footer Note */}
          <div className="mt-7 flex items-center justify-center gap-1.5 border-t border-white/[0.06] pt-4 text-[11px] text-[#71717A]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#D4AF37]" />
            <span>30-day encrypted HTTP-only PWA session</span>
          </div>
        </div>
      </div>
    </AuthContext.Provider>
  );
}
