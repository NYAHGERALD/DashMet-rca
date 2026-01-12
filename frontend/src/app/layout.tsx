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
