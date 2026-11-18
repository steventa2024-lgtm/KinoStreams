'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MailCheck,
  RefreshCw,
} from 'lucide-react';
import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils';

interface VerifyResponse {
  verified?: boolean;
  email?: string;
  challengeId?: string;
  verifiedToken?: string;
  error?: string;
  devPreview?: {
    enabled: boolean;
    code?: string;
  };
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'verifying' | 'code-entry' | 'error'>('verifying');
  const [email, setEmail] = useState<string>('');
  const [challengeId, setChallengeId] = useState<string>('');
  const [verifiedToken, setVerifiedToken] = useState<string>('');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string>('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | undefined>(undefined);

  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Missing verification token.');
      return;
    }

    let cancelled = false;
    fetch('/api/auth/email/verify-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = (await res.json()) as VerifyResponse;
        if (!res.ok || !data.verified || !data.challengeId || !data.verifiedToken) {
          throw new Error(data.error || 'Verification link is invalid or expired.');
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setEmail(data.email || '');
        setChallengeId(data.challengeId || '');
        setVerifiedToken(data.verifiedToken || '');
        setDevCode(data.devPreview?.code);
        setStatus('code-entry');
        setTimeout(() => digitRefs.current[0]?.focus(), 60);

        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const channel = new BroadcastChannel('kinostream-auth');
            channel.postMessage({
              type: 'email_verified',
              challengeId: data.challengeId,
              verifiedToken: data.verifiedToken,
              email: data.email,
              devPreview: data.devPreview,
            });
            channel.close();
          } catch {
            // Ignore BroadcastChannel errors
          }
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to verify this email link.'
        );
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const submitCode = useCallback(
    async (fullCode: string) => {
      if (!challengeId || !verifiedToken || fullCode.length !== 6) return;
      setSubmitting(true);
      setCodeError(null);
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
          error?: string;
        };
        if (!res.ok || !data.authenticated) {
          throw new Error(data.error || 'Invalid 6-digit verification code.');
        }

        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const channel = new BroadcastChannel('kinostream-auth');
            channel.postMessage({ type: 'auth_completed' });
            channel.close();
          } catch {
            // Ignore BroadcastChannel errors
          }
        }

        // Enter KinoStream directly in this same tab/link
        window.location.href = '/';
      } catch (err) {
        setCodeError(
          err instanceof Error ? err.message : 'Unable to verify code.'
        );
        setDigits(['', '', '', '', '', '']);
        digitRefs.current[0]?.focus();
      } finally {
        setSubmitting(false);
      }
    },
    [challengeId, verifiedToken]
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
      setCodeError(null);
      const focusIdx = Math.min(slice.length, 5);
      digitRefs.current[focusIdx]?.focus();
      if (slice.length === 6) {
        void submitCode(next.join(''));
      }
      return;
    }

    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    setCodeError(null);

    if (cleaned && index < 5) {
      digitRefs.current[index + 1]?.focus();
    }

    const joined = next.join('');
    if (joined.length === 6) {
      void submitCode(joined);
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
    setCodeError(null);
    const focusIdx = Math.min(pasted.length, 5);
    digitRefs.current[focusIdx]?.focus();
    if (pasted.length === 6) {
      void submitCode(pasted);
    }
  };

  const handleResendCode = async () => {
    if (!challengeId || !verifiedToken || resending) return;
    setResending(true);
    setCodeError(null);
    setResendMsg(null);
    try {
      const res = await fetch('/api/auth/email/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, verifiedToken }),
      });
      const data = (await res.json()) as {
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
      setResendMsg('A fresh 6-digit code has been sent to your inbox.');
      digitRefs.current[0]?.focus();
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : 'Unable to resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-x-hidden bg-[#080809] px-4 py-10 pt-safe pb-safe">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(229,9,53,0.16),transparent_55%)]" />

      <div className="relative z-10 w-full max-w-md rounded-xl border border-white/[0.08] bg-[#151517]/90 p-6 text-center shadow-2xl backdrop-blur-2xl sm:p-8">
        <p className="font-sans text-lg font-semibold tracking-[0.22em] text-[#FAFAFA]">
          {siteConfig.wordmark}
        </p>
        <p className="mt-1 text-[10px] font-medium tracking-[0.26em] text-[#71717A] uppercase">
          BY {siteConfig.creator.toUpperCase()}
        </p>

        {status === 'verifying' && (
          <div className="mt-8 space-y-4">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#fb5272]" />
            <h1 className="font-sans text-2xl font-medium text-[#FAFAFA]">
              Verifying Your Email
            </h1>
            <p className="text-sm text-[#A1A1AA]">
              Confirming your verification link and sending your 6-digit access code...
            </p>
          </div>
        )}

        {status === 'code-entry' && (
          <div className="mt-7 space-y-5">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#e50935]/40 bg-[#e50935]/15 text-[#fb5272]">
              <MailCheck className="h-6 w-6" />
            </div>

            <div>
              <div className="mx-auto mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Email Verified
              </div>
              <h1 className="font-sans text-2xl font-medium text-[#FAFAFA]">
                Enter 6-Digit Code
              </h1>
              <p className="mt-1.5 text-xs leading-relaxed text-[#A1A1AA]">
                Check your inbox{email ? ` (${email})` : ''} for your 6-digit code and enter it below to open KinoStream.
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
                    'min-h-[52px] w-full rounded-xl border bg-[#080809] text-center font-sans text-xl font-bold text-[#FAFAFA] transition focus:border-[#e50935] focus:outline-none',
                    val ? 'border-[#e50935]/60' : 'border-white/[0.12]'
                  )}
                />
              ))}
            </div>

            {devCode && (
              <div className="rounded-lg border border-[#e50935]/30 bg-[#080809]/80 p-3 text-xs text-[#A1A1AA]">
                Dev Mode Preview Code:{' '}
                <strong className="font-sans tracking-widest text-[#e4e4e7]">
                  {devCode}
                </strong>
              </div>
            )}

            {resendMsg && (
              <p className="text-xs font-medium text-[#e4e4e7]">{resendMsg}</p>
            )}

            {codeError && (
              <p className="text-xs font-medium text-[#EF4444]">{codeError}</p>
            )}

            <button
              type="button"
              disabled={submitting || digits.join('').length !== 6}
              onClick={() => void submitCode(digits.join(''))}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#FAFAFA] px-6 text-sm font-semibold text-[#080809] transition hover:bg-[#e2e2e2] disabled:opacity-45"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Verify &amp; Enter KinoStream
            </button>

            <div className="flex items-center justify-between pt-1">
              <Link
                href="/"
                className="inline-flex min-h-[44px] items-center text-xs text-[#71717A] hover:text-[#FAFAFA]"
              >
                Start Over
              </Link>

              <button
                type="button"
                disabled={resending}
                onClick={() => void handleResendCode()}
                className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-semibold text-[#e4e4e7] hover:underline disabled:opacity-50"
              >
                <RefreshCw className={cn('h-3 w-3', resending && 'animate-spin')} />
                Resend Code
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-8 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444]">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h1 className="font-sans text-2xl font-medium text-[#FAFAFA]">
              Link Expired or Invalid
            </h1>
            <p className="text-sm text-[#A1A1AA]">{error}</p>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-6 text-sm font-semibold text-[#FAFAFA] transition hover:border-[#e50935]/45"
              >
                Back to KinoStream Sign-In
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#080809]">
          <Loader2 className="h-8 w-8 animate-spin text-[#fb5272]" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
