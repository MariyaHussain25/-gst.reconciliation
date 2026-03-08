/**
 * @file apps/frontend/app/layout.tsx
 * @description Root layout for the GST Reconciliation Next.js app.
 * Applies global styles, metadata, Google Fonts (Noto Sans + Fira Code),
 * and wraps all pages with the Header component.
 *
 * Phase 1: Basic layout with navigation.
 * Phase 7: Added Noto Sans + Fira Code font integration.
 */

import type { Metadata } from 'next';
import './globals.css';
import { Header } from '../components/layout/Header';

export const metadata: Metadata = {
  title: 'GST Reconciliation System',
  description:
    'AI-powered GST Reconciliation and Input Tax Credit (ITC) Automation System for Indian businesses.',
  keywords: ['GST', 'reconciliation', 'ITC', 'GSTR-2A', 'GSTR-2B', 'India', 'tax'],
};

/**
 * Root layout wraps every page in the application.
 * Includes Google Fonts (Noto Sans + Fira Code) and the global Header.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <head>
        {/* Google Fonts: Noto Sans (headings + body) and Fira Code (mono / data) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Noto+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </body>
    </html>
  );
}
