// Phase 0.2: App Layout Structure

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { Providers } from '@/components/providers/Providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DashMet RCA Engine',
  description: 'Enterprise AI-Powered Root Cause Analysis Platform for Food Safety & Machine Issues',
  keywords: ['RCA', 'Root Cause Analysis', 'Food Safety', 'Manufacturing', 'AI'],
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/images/logo.png', type: 'image/png' },
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/images/logo.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'DashMet',
  },
  openGraph: {
    title: 'DashMet RCA Engine',
    description: 'Enterprise AI-Powered Root Cause Analysis Platform for Food Safety & Machine Issues',
    url: 'https://www.dashmet.com',
    siteName: 'DashMet',
    images: [
      {
        url: '/images/logo.png',
        width: 512,
        height: 512,
        alt: 'DashMet Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'DashMet RCA Engine',
    description: 'Enterprise AI-Powered Root Cause Analysis Platform',
    images: ['/images/logo.png'],
  },
  applicationName: 'DashMet',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <meta name="application-name" content="DashMet" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DashMet" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#10B981" />
        <meta name="msapplication-TileImage" content="/images/logo.png" />
        <meta name="theme-color" content="#10B981" />
        <link rel="icon" href="/images/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <script dangerouslySetInnerHTML={{
          __html: `
            try {
              const theme = localStorage.getItem('theme') || 'dark';
              document.documentElement.className = theme;
            } catch (e) {}
          `
        }} />
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Prevent white flash during page load */
            html.dark { background-color: #111827; }
            html.light { background-color: #f9fafb; }
            body { background-color: inherit; }
          `
        }} />
      </head>
      <body className={`${inter.className} bg-gray-50 dark:bg-gray-900`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
