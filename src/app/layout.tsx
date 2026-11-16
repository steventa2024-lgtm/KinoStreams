import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Inter, Playfair_Display } from 'next/font/google';
import { AuthGate, type InitialAuthSession } from '@/components/AuthGate';
import { AuthenticatedShell } from '@/components/AuthenticatedShell';
import { siteConfig } from '@/config/site';
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieToken,
} from '@/lib/auth-crypto';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} — Live TV, Sports & Cinema`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: siteConfig.name,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#09090B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionCookieToken(sessionToken);

  const initialSession: InitialAuthSession = {
    authenticated: Boolean(session),
    user: session
      ? {
          email: session.email,
          name: session.name,
          provider: session.provider,
        }
      : null,
    googleEnabled: Boolean(
      process.env.GOOGLE_CLIENT_ID?.trim() &&
        process.env.GOOGLE_CLIENT_SECRET?.trim()
    ),
    emailDeliveryConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
  };

  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} dark`}
    >
      <body className="min-h-screen bg-[#09090B] font-sans text-[#FAFAFA] antialiased selection:bg-[#D4AF37]/30 selection:text-[#FAFAFA]">
        <AuthGate initialSession={initialSession}>
          <AuthenticatedShell>{children}</AuthenticatedShell>
        </AuthGate>
      </body>
    </html>
  );
}
